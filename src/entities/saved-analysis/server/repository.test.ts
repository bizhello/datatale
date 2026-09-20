import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MemorySavedAnalysisRepository } from "./memory-repository.test-support";

const reportStorageBoundary = z
  .object({ hero: z.array(z.unknown()).min(2).max(3) })
  .passthrough();

const validators = {
  source: z.unknown(),
  report: reportStorageBoundary,
};

const workspaceId = "00000000-0000-4000-8000-000000000001";
const analysisId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-09-19T12:00:00.000Z");
const report = {
  version: 1 as const,
  hero: [
    {
      text: "Observed",
      factIds: ["fact"],
      evidenceIds: ["evidence"],
      kind: "observation" as const,
    },
    {
      text: "Confirmed",
      factIds: ["fact"],
      evidenceIds: ["evidence"],
      kind: "observation" as const,
    },
  ],
  metrics: [
    {
      id: "fact",
      label: "Count",
      value: 1,
      calculation: { kind: "count" },
      evidenceIds: ["evidence"],
    },
  ],
  charts: [],
  evidence: [
    { id: "evidence", kind: "quote" as const, label: "Source", excerpt: "One" },
  ],
  recommendations: [],
  noChartReason: "No chart is needed.",
};

function repository() {
  const result = new MemorySavedAnalysisRepository(validators);
  result.addWorkspace(workspaceId, new Date("2026-10-19T12:00:00.000Z"));
  return result;
}

describe("saved analysis memory repository", () => {
  it("rejects an incompatible one-item hero at the persistence boundary", async () => {
    const result = repository();
    await expect(
      result.create({
        workspaceId,
        analysisId,
        source: { rawText: "One" },
        report: { ...report, hero: [report.hero[0]] },
        now,
      }),
    ).rejects.toThrow();
  });

  it("round-trips text sources and enforces ownership and expiry", async () => {
    const result = repository();
    await expect(
      result.create({
        workspaceId,
        analysisId,
        source: {
          version: 1,
          id: "text-1",
          source: { kind: "text" },
          rawText: "One",
          paragraphs: [{ index: 1, text: "One" }],
        },
        report,
        now,
      }),
    ).resolves.toBeDefined();
    await expect(result.listSummaries(workspaceId, now)).resolves.toEqual([
      {
        id: analysisId,
        sourceKind: "text",
        createdAt: now,
        expiresAt: new Date("2026-09-26T12:00:00.000Z"),
      },
    ]);
    await expect(
      result.get("00000000-0000-4000-8000-000000000003", analysisId, now),
    ).resolves.toBeUndefined();
    await expect(
      result.list("00000000-0000-4000-8000-000000000003", now),
    ).resolves.toEqual([]);
    await expect(
      result.get(workspaceId, analysisId, new Date("2026-11-01T00:00:00.000Z")),
    ).resolves.toBeUndefined();
  });

  it("keeps message order, makes retries idempotent, and applies a daily bound", async () => {
    const result = repository();
    await result.create({
      workspaceId,
      analysisId,
      source: {
        version: 1,
        id: "text-1",
        source: { kind: "text" },
        rawText: "One",
        paragraphs: [{ index: 1, text: "One" }],
      },
      report,
      now,
    });
    const first = await result.appendMessage({
      workspaceId,
      analysisId,
      dailyLimit: 2,
      now,
      message: { id: "m-1", role: "user", content: "Question" },
    });
    expect(
      await result.appendMessage({
        workspaceId,
        analysisId,
        dailyLimit: 2,
        now,
        message: { id: "m-1", role: "user", content: "Question" },
      }),
    ).toEqual(first);
    for (let index = 2; index <= 10; index++) {
      await result.appendMessage({
        workspaceId,
        analysisId,
        dailyLimit: 10,
        now,
        message: {
          id: `m-${index}`,
          role: "user",
          content: `Question ${index}`,
        },
      });
      await result.appendMessage({
        workspaceId,
        analysisId,
        dailyLimit: 10,
        now,
        message: {
          id: `a-${index}`,
          role: "assistant",
          content: `Answer ${index}`,
        },
      });
    }
    await expect(
      result.appendMessage({
        workspaceId,
        analysisId,
        dailyLimit: 10,
        now,
        message: { id: "m-11", role: "user", content: "Again" },
      }),
    ).resolves.toBe("quota-exceeded");
    await result.appendMessage({
      workspaceId,
      analysisId,
      dailyLimit: 10,
      now,
      message: { id: "a-11", role: "assistant", content: "Answer 11" },
    });
    const history = await result.messages({ workspaceId, analysisId, now });
    expect(history.slice(0, 2)).toMatchObject([{ id: "m-1" }, { id: "m-2" }]);
    await expect(
      result.messages({ workspaceId, analysisId, limit: 3, now }),
    ).resolves.toMatchObject([{ id: "m-10" }, { id: "a-10" }, { id: "a-11" }]);
    await expect(
      result.appendMessage({
        workspaceId,
        analysisId,
        dailyLimit: 10,
        now,
        message: { id: "m-1", role: "assistant", content: "Changed" },
      }),
    ).rejects.toThrow("different content");
  });

  it("shares the daily user-message allowance across reports and preserves usage when raised", async () => {
    const result = repository();
    const secondAnalysisId = "00000000-0000-4000-8000-000000000003";
    const source = {
      version: 1 as const,
      id: "text-1",
      source: { kind: "text" as const },
      rawText: "One",
      paragraphs: [{ index: 1, text: "One" }],
    };
    await result.create({ workspaceId, analysisId, source, report, now });
    await result.create({
      workspaceId,
      analysisId: secondAnalysisId,
      source: { ...source, id: "text-2" },
      report,
      now,
    });

    for (let index = 0; index < 4; index++)
      await expect(
        result.appendMessage({
          workspaceId,
          analysisId,
          dailyLimit: 5,
          now,
          message: {
            id: `first-report-${index}`,
            role: "user",
            content: `Question ${index}`,
          },
        }),
      ).resolves.toBeDefined();
    await expect(
      result.appendMessage({
        workspaceId,
        analysisId: secondAnalysisId,
        dailyLimit: 5,
        now,
        message: { id: "second-report-1", role: "user", content: "Question" },
      }),
    ).resolves.toBeDefined();
    await expect(
      result.appendMessage({
        workspaceId,
        analysisId: secondAnalysisId,
        dailyLimit: 5,
        now,
        message: { id: "second-report-2", role: "user", content: "Blocked" },
      }),
    ).resolves.toBe("quota-exceeded");

    for (let index = 5; index < 20; index++)
      await expect(
        result.appendMessage({
          workspaceId,
          analysisId: secondAnalysisId,
          dailyLimit: 20,
          now,
          message: {
            id: `unlocked-${index}`,
            role: "user",
            content: `Unlocked question ${index}`,
          },
        }),
      ).resolves.toBeDefined();
    await expect(
      result.appendMessage({
        workspaceId,
        analysisId,
        dailyLimit: 20,
        now,
        message: { id: "unlocked-21", role: "user", content: "Blocked" },
      }),
    ).resolves.toBe("quota-exceeded");
  });

  it("keeps creation expiry fixed and cleans expired history", async () => {
    const result = repository();
    const created = await result.create({
      workspaceId,
      analysisId,
      source: {
        version: 1,
        id: "text-1",
        source: { kind: "text" },
        rawText: "One",
        paragraphs: [{ index: 1, text: "One" }],
      },
      report,
      now,
    });
    expect(created?.expiresAt).toEqual(new Date("2026-09-26T12:00:00.000Z"));
    await result.get(
      workspaceId,
      analysisId,
      new Date("2026-09-20T12:00:00.000Z"),
    );
    expect((await result.get(workspaceId, analysisId, now))?.expiresAt).toEqual(
      created?.expiresAt,
    );
    await result.appendMessage({
      workspaceId,
      analysisId,
      dailyLimit: 10,
      now,
      message: { id: "m-1", role: "user", content: "Question" },
    });
    expect(await result.cleanup(new Date("2026-09-27T00:00:00.000Z"))).toBe(1);
    await expect(
      result.messages({ workspaceId, analysisId, now }),
    ).resolves.toEqual([]);
  });

  it("does not overwrite an immutable payload on a retry", async () => {
    const result = repository();
    await result.create({
      workspaceId,
      analysisId,
      source: {
        version: 1,
        id: "text-1",
        source: { kind: "text" },
        rawText: "One",
        paragraphs: [{ index: 1, text: "One" }],
      },
      report,
      now,
    });
    await expect(
      result.create({
        workspaceId,
        analysisId,
        source: {
          paragraphs: [{ index: 1, text: "One" }],
          rawText: "One",
          source: { kind: "text" },
          id: "text-1",
          version: 1,
        },
        report: {
          recommendations: [],
          evidence: report.evidence,
          charts: [],
          metrics: report.metrics,
          hero: report.hero,
          noChartReason: "No chart is needed.",
          version: 1,
        },
        now,
      }),
    ).resolves.toBeDefined();
    await expect(
      result.create({
        workspaceId,
        analysisId,
        source: {
          version: 1,
          id: "text-1",
          source: { kind: "text" },
          rawText: "Two",
          paragraphs: [{ index: 1, text: "Two" }],
        },
        report,
        now,
      }),
    ).rejects.toThrow("immutable");
  });

  it("allows only one concurrent inference lease and releases it for retry", async () => {
    const result = repository();
    await result.create({
      workspaceId,
      analysisId,
      source: {
        version: 1,
        id: "text-1",
        source: { kind: "text" },
        rawText: "One",
        paragraphs: [{ index: 1, text: "One" }],
      },
      report,
      now,
    });
    await result.appendMessage({
      workspaceId,
      analysisId,
      dailyLimit: 10,
      now,
      message: { id: "m-lease", role: "user", content: "Question" },
    });
    const claims = await Promise.all(
      Array.from({ length: 2 }, () =>
        result.claimInference({
          workspaceId,
          analysisId,
          messageId: "m-lease",
          now,
        }),
      ),
    );
    expect(claims.filter((claim) => claim !== "in-flight")).toHaveLength(1);
    const lease = claims.find((claim) => typeof claim === "object");
    if (!lease || typeof lease === "string") throw new Error("Lease missing");
    await result.releaseInference({
      analysisId,
      messageId: "m-lease",
      token: lease.token,
    });
    await expect(
      result.claimInference({
        workspaceId,
        analysisId,
        messageId: "m-lease",
        now,
      }),
    ).resolves.toMatchObject({ token: expect.any(String) });
  });
});
