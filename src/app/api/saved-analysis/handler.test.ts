import { describe, expect, it, vi } from "vitest";
import { createSavedAnalysisHandlers } from "./handler";

const workspace = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-10-19T00:00:00.000Z",
};
const analysisId = "00000000-0000-4000-8000-000000000002";
const source = {
  version: 1 as const,
  id: "text-1",
  source: { kind: "text" as const },
  rawText: "One",
  paragraphs: [{ index: 1, text: "One" }],
};
const report = {
  version: 1 as const,
  hero: [
    {
      text: "Observed",
      factIds: [],
      evidenceIds: ["evidence"],
      kind: "observation" as const,
    },
    {
      text: "Confirmed",
      factIds: [],
      evidenceIds: ["evidence"],
      kind: "observation" as const,
    },
  ],
  metrics: [],
  charts: [],
  evidence: [
    { id: "evidence", kind: "quote" as const, label: "Source", excerpt: "One" },
  ],
  recommendations: [],
  noChartReason: "No chart is needed.",
};

function request() {
  return new Request("https://example.test/api/saved-analysis", {
    method: "GET",
  });
}

describe("saved analysis read handlers", () => {
  it.each([
    ["runtime unavailable", () => false, workspace, false, 503, "unavailable"],
    ["missing workspace", () => true, undefined, false, 401, "expired"],
    ["inactive workspace", () => true, workspace, false, 401, "expired"],
  ])(
    "handles %s without reading storage",
    async (_name, runtime, current, active, status, code) => {
      const repository = {
        listSummaries: vi.fn(),
        get: vi.fn(),
        messages: vi.fn(),
      };
      const handlers = createSavedAnalysisHandlers({
        runtimeSafe: runtime,
        readWorkspace: vi.fn(async () => current),
        isWorkspaceActive: vi.fn(async () => active),
        repository,
      });
      const response = await handlers.list(request());
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ code });
      expect(repository.listSummaries).not.toHaveBeenCalled();
    },
  );

  it("reads summaries without creating a workspace or loading detail rows", async () => {
    const listSummaries = vi.fn(async () => [
      {
        id: analysisId,
        sourceKind: "text" as const,
        createdAt: new Date("2026-09-19T12:00:00.000Z"),
        expiresAt: new Date("2026-09-26T12:00:00.000Z"),
      },
    ]);
    const get = vi.fn();
    const handlers = createSavedAnalysisHandlers({
      runtimeSafe: () => true,
      readWorkspace: vi.fn(async () => workspace),
      isWorkspaceActive: vi.fn(async () => true),
      repository: { listSummaries, get, messages: vi.fn() },
    });

    const response = await handlers.list(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analyses: [
        {
          id: analysisId,
          sourceKind: "text",
          createdAt: "2026-09-19T12:00:00.000Z",
          expiresAt: "2026-09-26T12:00:00.000Z",
        },
      ],
    });
    expect(listSummaries).toHaveBeenCalledOnce();
    expect(get).not.toHaveBeenCalled();
  });

  it("fails closed when an assistant row has no canonical result", async () => {
    const handlers = createSavedAnalysisHandlers({
      runtimeSafe: () => true,
      readWorkspace: vi.fn(async () => workspace),
      isWorkspaceActive: vi.fn(async () => true),
      repository: {
        listSummaries: vi.fn(async () => []),
        get: vi.fn(async () => ({
          id: analysisId,
          workspaceId: workspace.id,
          source,
          report,
          createdAt: new Date("2026-09-19T12:00:00.000Z"),
          lastAccessedAt: new Date("2026-09-19T12:00:00.000Z"),
          expiresAt: new Date("2026-09-26T12:00:00.000Z"),
        })),
        messages: vi.fn(async () => [
          {
            id: "m:assistant",
            analysisId,
            role: "assistant" as const,
            content: "Unknown",
            createdAt: new Date("2026-09-19T12:01:00.000Z"),
          },
        ]),
      },
    });

    const response = await handlers.detail(request(), analysisId);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ code: "unavailable" });
  });

  it.each([
    ["source", { invalid: true }, report],
    ["report", source, { invalid: true }],
  ])(
    "fails closed for corrupt persisted %s payloads",
    async (_field, invalidSource, invalidReport) => {
      const handlers = createSavedAnalysisHandlers({
        runtimeSafe: () => true,
        readWorkspace: vi.fn(async () => workspace),
        isWorkspaceActive: vi.fn(async () => true),
        repository: {
          listSummaries: vi.fn(async () => []),
          get: vi.fn(async () => ({
            id: analysisId,
            workspaceId: workspace.id,
            source: invalidSource,
            report: invalidReport,
            createdAt: new Date("2026-09-19T12:00:00.000Z"),
            lastAccessedAt: new Date("2026-09-19T12:00:00.000Z"),
            expiresAt: new Date("2026-09-26T12:00:00.000Z"),
          })),
          messages: vi.fn(async () => []),
        },
      });
      expect((await handlers.detail(request(), analysisId)).status).toBe(503);
    },
  );

  it("returns ordered persisted messages with a strict canonical assistant result", async () => {
    const handlers = createSavedAnalysisHandlers({
      runtimeSafe: () => true,
      readWorkspace: vi.fn(async () => workspace),
      isWorkspaceActive: vi.fn(async () => true),
      repository: {
        listSummaries: vi.fn(async () => []),
        get: vi.fn(async () => ({
          id: analysisId,
          workspaceId: workspace.id,
          source,
          report,
          createdAt: new Date("2026-09-19T12:00:00.000Z"),
          lastAccessedAt: new Date("2026-09-19T12:00:00.000Z"),
          expiresAt: new Date("2026-09-26T12:00:00.000Z"),
        })),
        messages: vi.fn(async () => [
          {
            id: "m-1",
            analysisId,
            role: "user" as const,
            content: "Сколько строк?",
            createdAt: new Date("2026-09-19T12:00:00.000Z"),
          },
          {
            id: "m-1:assistant",
            analysisId,
            role: "assistant" as const,
            content: "Одна строка.",
            result: {
              outcome: "answered" as const,
              answer: "Одна строка.",
              references: [{ id: "e" }],
            },
            createdAt: new Date("2026-09-19T12:00:01.000Z"),
          },
        ]),
      },
    });
    const response = await handlers.detail(request(), analysisId);
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.messages.map((message: { id: string }) => message.id)).toEqual(
      ["m-1", "m-1:assistant"],
    );
    expect(value.messages[1].result.outcome).toBe("answered");
  });

  it("returns a generic not-found for a foreign or malformed id", async () => {
    const get = vi.fn(async () => undefined);
    const handlers = createSavedAnalysisHandlers({
      runtimeSafe: () => true,
      readWorkspace: vi.fn(async () => workspace),
      isWorkspaceActive: vi.fn(async () => true),
      repository: {
        listSummaries: vi.fn(async () => []),
        get,
        messages: vi.fn(),
      },
    });
    expect((await handlers.detail(request(), analysisId)).status).toBe(404);
    expect((await handlers.detail(request(), "bad-id")).status).toBe(404);
    expect(get).toHaveBeenCalledOnce();
  });
});
