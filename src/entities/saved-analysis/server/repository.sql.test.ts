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
  it("normalizes a persisted SQL null result for user messages", async () => {
    const sql = vi.fn(async () => [
      {
        id: "message-1",
        analysisId,
        role: "user",
        content: "What changed?",
        result: null,
        createdAt: now,
      },
    ]);
    const repository = new SqlSavedAnalysisRepository(validators, sql as never);

    await expect(
      repository.messages({ workspaceId, analysisId, now }),
    ).resolves.toEqual([
      {
        id: "message-1",
        analysisId,
        role: "user",
        content: "What changed?",
        result: undefined,
        createdAt: now,
      },
    ]);
  });

  it("returns a newly inserted user message whose SQL result is null", async () => {
    const sql = vi.fn(async () => [
      {
        message_id: "message-1",
        analysis_id: analysisId,
        role: "user",
        content: "What changed?",
        result: null,
        created_at: now,
        quotaExceeded: false,
        messageConflict: false,
      },
    ]);
    const repository = new SqlSavedAnalysisRepository(validators, sql as never);

    await expect(
      repository.appendMessage({
        workspaceId,
        analysisId,
        message: { id: "message-1", role: "user", content: "What changed?" },
        dailyLimit: 10,
        now,
      }),
    ).resolves.toMatchObject({
      id: "message-1",
      role: "user",
      result: undefined,
    });
  });

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
