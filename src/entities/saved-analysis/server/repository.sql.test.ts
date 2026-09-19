import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SqlSavedAnalysisRepository } from "./repository";

vi.mock("server-only", () => ({}));

const workspaceId = "00000000-0000-4000-8000-000000000001";
const analysisId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-09-19T12:00:00.000Z");
const validators = {
  source: z.unknown(),
  report: z.unknown(),
  messageResult: z.object({ outcome: z.string() }),
};

describe("saved analysis SQL repository boundaries", () => {
  it("fails closed when a summary row is corrupt", async () => {
    const sql = vi.fn(async () => [
      {
        id: analysisId,
        sourceKind: "legacy",
        createdAt: now,
        expiresAt: new Date("2026-09-26T12:00:00.000Z"),
      },
    ]);
    const repository = new SqlSavedAnalysisRepository(validators, sql as never);
    await expect(repository.listSummaries(workspaceId, now)).rejects.toThrow(
      "canonical validation",
    );
  });

  it("fails closed when any persisted message row is corrupt", async () => {
    const sql = vi.fn(async () => [
      {
        id: "message-1",
        analysisId,
        role: "assistant",
        content: "Answer",
        result: { invalid: true },
        createdAt: now,
      },
    ]);
    const repository = new SqlSavedAnalysisRepository(validators, sql as never);
    await expect(
      repository.messages({ workspaceId, analysisId, now }),
    ).rejects.toThrow("canonical validation");
  });
});
