import { describe, expect, it } from "vitest";
import { RunGate } from "./run-gate";
import { MemoryRunGateRepository } from "./run-gate-memory-repository";

const at = (value: string) => new Date(value);
const input = (
  overrides: Partial<{
    workspaceId: string;
    ipHash: string;
    key: string;
    fingerprint: string;
    now: Date;
  }> = {},
) => ({
  workspaceId: "00000000-0000-4000-8000-000000000001",
  ipHash: "salted-ip",
  key: "key-1",
  fingerprint: "fingerprint-1",
  now: at("2026-09-19T12:00:00Z"),
  ...overrides,
});
const setup = () => {
  const repository = new MemoryRunGateRepository<{ value: string }>();
  return {
    repository,
    gate: new RunGate(repository, {
      workspaceDailyLimit: 2,
      ipDailyLimit: 3,
      globalDailyLimit: 4,
    }),
  };
};

describe("RunGate lifecycle", () => {
  it("allows only one concurrent same-key claim and replays a completed matching receipt", async () => {
    const { gate } = setup();
    const first = await gate.claim(input());
    const second = await gate.claim(input());
    expect(first.kind).toBe("claimed");
    expect(second).toEqual({ kind: "in-flight" });
    if (first.kind !== "claimed") throw new Error("claim expected");
    expect(
      await gate.markProviderStarted(
        input().workspaceId,
        first.receiptId,
        input().now,
      ),
    ).toBe(true);
    await gate.succeed(
      input().workspaceId,
      first.receiptId,
      { value: "checked" },
      input().now,
    );
    await expect(gate.claim(input())).resolves.toEqual({
      kind: "replay",
      report: { value: "checked" },
    });
  });
  it("rejects a different fingerprint and does not replay provider-started crash records", async () => {
    const { gate } = setup();
    const first = await gate.claim(input());
    if (first.kind !== "claimed") throw new Error("claim expected");
    expect(await gate.claim(input({ fingerprint: "other" }))).toEqual({
      kind: "conflict",
    });
    await gate.markProviderStarted(
      input().workspaceId,
      first.receiptId,
      input().now,
    );
    await expect(
      gate.claim(input({ now: at("2026-09-19T12:03:00Z") })),
    ).resolves.toEqual({ kind: "provider-started" });
  });
  it("reclaims only an unspent expired lease and permits an unspent failure retry", async () => {
    const { gate } = setup();
    const first = await gate.claim(input());
    if (first.kind !== "claimed") throw new Error("claim expected");
    await expect(
      gate.claim(input({ now: at("2026-09-19T12:01:31Z") })),
    ).resolves.toMatchObject({ kind: "claimed", receiptId: first.receiptId });
    await gate.fail(
      input().workspaceId,
      first.receiptId,
      false,
      "network",
      at("2026-09-19T12:01:31Z"),
    );
    await expect(
      gate.claim(input({ now: at("2026-09-19T12:01:32Z") })),
    ).resolves.toMatchObject({ kind: "claimed", receiptId: first.receiptId });
  });
  it("enforces all daily scopes and resets at UTC midnight", async () => {
    const { gate } = setup();
    const time = at("2026-09-19T23:59:00Z");
    await gate.claim(input({ now: time, key: "a" }));
    await gate.claim(input({ now: time, key: "b" }));
    await expect(gate.claim(input({ now: time, key: "c" }))).resolves.toEqual({
      kind: "quota",
      scope: "workspace",
    });
    await expect(
      gate.claim(input({ now: at("2026-09-20T00:00:00Z"), key: "c" })),
    ).resolves.toMatchObject({ kind: "claimed" });
  });
  it("expires receipts and buckets on cleanup and deletes all private workspace receipts", async () => {
    const { gate, repository } = setup();
    const claimed = await gate.claim(input());
    expect(claimed.kind).toBe("claimed");
    expect(
      await repository.cleanup(at("2026-09-19T12:16:00Z")),
    ).toBeGreaterThan(0);
    expect(await gate.claim(input())).toMatchObject({ kind: "claimed" });
    expect(await repository.deleteWorkspace(input().workspaceId)).toBe(true);
    expect(await repository.deleteWorkspace(input().workspaceId)).toBe(false);
  });
  it("fails closed for missing or non-positive caps", async () => {
    const gate = new RunGate(new MemoryRunGateRepository(), {
      workspaceDailyLimit: 0,
      ipDailyLimit: 1,
      globalDailyLimit: 1,
    });
    await expect(gate.claim(input())).resolves.toEqual({ kind: "unavailable" });
  });
});
