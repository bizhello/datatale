import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/shared/lib/db";
import type {
  ClaimInput,
  RunGateConfig,
  RunGateOutcome,
  RunGateRepository,
} from "./run-gate";

type Sql = ReturnType<typeof getDatabase>;
const day = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
/** PostgreSQL repository. Its claim statement locks the receipt key before incrementing quota buckets. */
export class SqlRunGateRepository<Report = unknown>
  implements RunGateRepository<Report>
{
  constructor(private readonly sql: Sql = getDatabase()) {}
  private client() {
    if (!this.sql) throw new Error("Database unavailable");
    return this.sql;
  }
  async claim(
    input: ClaimInput,
    config: Required<RunGateConfig>,
  ): Promise<RunGateOutcome<Report>> {
    const sql = this.client();
    const now = input.now ?? new Date();
    const expires = new Date(now.getTime() + config.receiptTtlMs);
    const lease = new Date(now.getTime() + config.leaseMs);
    const quotaExpires = new Date(now.getTime() + config.quotaTtlMs);
    const id = randomUUID();
    // One transaction serializes a workspace/key claim. Quotas are incremented only for a new/reclaimed unspent receipt.
    const rows = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${input.workspaceId}:${input.key}`}))`,
      sql`SELECT id, fingerprint, state, provider_started_at, lease_expires_at, expires_at, report FROM analysis_runs WHERE workspace_id = ${input.workspaceId} AND idempotency_key = ${input.key} FOR UPDATE`,
    ]);
    const existing = rows[1]?.[0] as Record<string, unknown> | undefined;
    if (existing && new Date(String(existing.expires_at)) > now) {
      if (existing.fingerprint !== input.fingerprint)
        return { kind: "conflict" };
      if (existing.state === "succeeded" && existing.report !== null)
        return { kind: "replay", report: existing.report as Report };
      if (
        existing.state === "provider_started" ||
        (existing.state === "failed" && existing.provider_started_at)
      )
        return { kind: "provider-started" };
      if (
        existing.state === "claimed" &&
        new Date(String(existing.lease_expires_at)) > now
      )
        return { kind: "in-flight" };
      await sql`UPDATE analysis_runs SET state = 'claimed', lease_expires_at = ${lease}, failure_code = NULL WHERE id = ${existing.id as string}`;
      return { kind: "claimed", receiptId: existing.id as string };
    }
    const scopes: Array<[string, number, "workspace" | "ip" | "global"]> = [
      [
        `workspace:${input.workspaceId}`,
        config.workspaceDailyLimit,
        "workspace",
      ],
      [`ip:${input.ipHash}`, config.ipDailyLimit, "ip"],
      ["global", config.globalDailyLimit, "global"],
    ];
    const bucket = day(now);
    for (const [scope, limit, kind] of scopes) {
      const count =
        await sql`SELECT count FROM analysis_quota_buckets WHERE scope = ${scope} AND bucket_start = ${bucket} AND expires_at > ${now}`;
      if (Number(count[0]?.count ?? 0) >= limit)
        return { kind: "quota", scope: kind };
    }
    for (const [scope] of scopes)
      await sql`INSERT INTO analysis_quota_buckets (scope, bucket_start, count, expires_at) VALUES (${scope}, ${bucket}, 1, ${quotaExpires}) ON CONFLICT (scope, bucket_start) DO UPDATE SET count = analysis_quota_buckets.count + 1, expires_at = EXCLUDED.expires_at`;
    await sql`INSERT INTO analysis_runs (id, workspace_id, idempotency_key, fingerprint, state, lease_expires_at, expires_at) VALUES (${id}, ${input.workspaceId}, ${input.key}, ${input.fingerprint}, 'claimed', ${lease}, ${expires}) ON CONFLICT (workspace_id, idempotency_key) DO NOTHING`;
    return { kind: "claimed", receiptId: id };
  }
  async markProviderStarted(workspaceId: string, receiptId: string, now: Date) {
    const rows =
      await this.client()`UPDATE analysis_runs SET state = 'provider_started', provider_started_at = ${now} WHERE id = ${receiptId} AND workspace_id = ${workspaceId} AND state = 'claimed' AND expires_at > ${now} RETURNING id`;
    return rows.length === 1;
  }
  async succeed(
    workspaceId: string,
    receiptId: string,
    report: Report,
    now: Date,
  ) {
    const rows =
      await this.client()`UPDATE analysis_runs SET state = 'succeeded', report = ${JSON.stringify(report)}::jsonb WHERE id = ${receiptId} AND workspace_id = ${workspaceId} AND state = 'provider_started' AND expires_at > ${now} RETURNING id`;
    return rows.length === 1;
  }
  async fail(
    workspaceId: string,
    receiptId: string,
    providerSpent: boolean,
    code: string,
    now: Date,
  ) {
    const rows =
      await this.client()`UPDATE analysis_runs SET state = 'failed', provider_started_at = CASE WHEN ${providerSpent} THEN COALESCE(provider_started_at, ${now}) ELSE NULL END, failure_code = ${code} WHERE id = ${receiptId} AND workspace_id = ${workspaceId} AND state IN ('claimed', 'provider_started') AND expires_at > ${now} RETURNING id`;
    return rows.length === 1;
  }
  async cleanup(now: Date) {
    const sql = this.client();
    const rows = await sql.transaction([
      sql`DELETE FROM analysis_runs WHERE expires_at <= ${now} RETURNING id`,
      sql`DELETE FROM guest_workspaces WHERE expires_at <= ${now} OR revoked_at IS NOT NULL RETURNING id`,
      sql`DELETE FROM analysis_quota_buckets WHERE expires_at <= ${now} RETURNING scope`,
    ]);
    return rows.reduce((sum, values) => sum + values.length, 0);
  }
  async deleteWorkspace(workspaceId: string) {
    const sql = this.client();
    const rows = await sql.transaction([
      sql`DELETE FROM analysis_runs WHERE workspace_id = ${workspaceId} RETURNING id`,
      sql`DELETE FROM guest_workspaces WHERE id = ${workspaceId} RETURNING id`,
    ]);
    return (rows[1]?.length ?? 0) === 1;
  }
}
