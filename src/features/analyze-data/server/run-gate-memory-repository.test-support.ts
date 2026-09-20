import { randomUUID } from "node:crypto";
import type {
  ClaimInput,
  RunGateConfig,
  RunGateOutcome,
  RunGateRepository,
  RunReceipt,
} from "./run-gate";

type Bucket = { count: number; expiresAt: Date };
const day = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
/** Deterministic test double; production uses the transactional SQL repository. */
export class MemoryRunGateRepository<Report = unknown>
  implements RunGateRepository<Report>
{
  readonly receipts = new Map<string, RunReceipt<Report>>();
  readonly buckets = new Map<string, Bucket>();
  private receipt(workspaceId: string, key: string) {
    return this.receipts.get(`${workspaceId}:${key}`);
  }
  async claim(
    input: ClaimInput,
    config: Required<RunGateConfig>,
  ): Promise<RunGateOutcome<Report>> {
    const now = input.now ?? new Date();
    const existing = this.receipt(input.workspaceId, input.key);
    if (existing && existing.expiresAt > now) {
      if (existing.fingerprint !== input.fingerprint)
        return { kind: "conflict" };
      if (existing.state === "succeeded" && existing.report !== undefined)
        return { kind: "replay", report: existing.report };
      if (
        existing.state === "provider_started" ||
        (existing.state === "failed" && existing.providerStartedAt)
      )
        return { kind: "provider-started" };
      if (existing.state === "claimed" && existing.leaseExpiresAt > now)
        return { kind: "in-flight" };
      if (existing.state === "failed" || existing.state === "claimed") {
        const { failureCode: _failureCode, ...unfailed } = existing;
        const reclaimed: RunReceipt<Report> = {
          ...unfailed,
          state: "claimed",
          leaseExpiresAt: new Date(now.getTime() + config.leaseMs),
        };
        this.receipts.set(`${input.workspaceId}:${input.key}`, reclaimed);
        return { kind: "claimed", receiptId: reclaimed.id };
      }
    }
    const scopes: ReadonlyArray<readonly [string, number]> = [
      [
        `workspace:${input.workspaceId}`,
        input.unlocked
          ? config.unlockedWorkspaceDailyLimit
          : config.freeWorkspaceDailyLimit,
      ],
      ...(input.unlocked
        ? []
        : [[`ip:${input.ipHash}`, config.ipDailyLimit] as const]),
      ["global", config.globalDailyLimit],
    ];
    for (const [scope, limit] of scopes) {
      const bucket = this.buckets.get(`${scope}:${day(now)}`);
      if (bucket && bucket.expiresAt > now && bucket.count >= limit)
        return {
          kind: "quota",
          scope:
            scope === "global"
              ? "global"
              : scope.startsWith("ip:")
                ? "ip"
                : "workspace",
        };
    }
    for (const [scope] of scopes) {
      const id = `${scope}:${day(now)}`;
      const bucket = this.buckets.get(id);
      this.buckets.set(id, {
        count: (bucket?.count ?? 0) + 1,
        expiresAt: new Date(now.getTime() + config.quotaTtlMs),
      });
    }
    const receipt: RunReceipt<Report> = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      key: input.key,
      fingerprint: input.fingerprint,
      state: "claimed",
      leaseExpiresAt: new Date(now.getTime() + config.leaseMs),
      expiresAt: new Date(now.getTime() + config.receiptTtlMs),
    };
    this.receipts.set(`${input.workspaceId}:${input.key}`, receipt);
    return { kind: "claimed", receiptId: receipt.id };
  }
  async markProviderStarted(workspaceId: string, receiptId: string, now: Date) {
    return this.update(workspaceId, receiptId, (receipt) =>
      receipt.state === "claimed" && receipt.expiresAt > now
        ? { ...receipt, state: "provider_started", providerStartedAt: now }
        : undefined,
    );
  }
  async succeed(
    workspaceId: string,
    receiptId: string,
    report: Report,
    now: Date,
  ) {
    return this.update(workspaceId, receiptId, (receipt) =>
      receipt.state === "provider_started" && receipt.expiresAt > now
        ? { ...receipt, state: "succeeded", report }
        : undefined,
    );
  }
  async fail(
    workspaceId: string,
    receiptId: string,
    providerSpent: boolean,
    code: string,
    now: Date,
  ) {
    return this.update(workspaceId, receiptId, (receipt) => {
      if (
        receipt.expiresAt <= now ||
        (receipt.state !== "claimed" && receipt.state !== "provider_started")
      )
        return undefined;
      const { providerStartedAt: _started, ...unstarted } = receipt;
      return providerSpent
        ? {
            ...receipt,
            state: "failed",
            providerStartedAt: receipt.providerStartedAt ?? now,
            failureCode: code,
          }
        : { ...unstarted, state: "failed", failureCode: code };
    });
  }
  private update(
    workspaceId: string,
    receiptId: string,
    change: (receipt: RunReceipt<Report>) => RunReceipt<Report> | undefined,
  ) {
    for (const [key, receipt] of this.receipts)
      if (receipt.workspaceId === workspaceId && receipt.id === receiptId) {
        const next = change(receipt);
        if (!next) return Promise.resolve(false);
        this.receipts.set(key, next);
        return Promise.resolve(true);
      }
    return Promise.resolve(false);
  }
  async cleanup(now: Date) {
    let removed = 0;
    for (const [key, receipt] of this.receipts)
      if (receipt.expiresAt <= now) {
        this.receipts.delete(key);
        removed++;
      }
    for (const [key, bucket] of this.buckets)
      if (bucket.expiresAt <= now) {
        this.buckets.delete(key);
        removed++;
      }
    return removed;
  }
  async deleteWorkspace(workspaceId: string) {
    let found = false;
    for (const [key, receipt] of this.receipts)
      if (receipt.workspaceId === workspaceId) {
        this.receipts.delete(key);
        found = true;
      }
    return found;
  }
}
