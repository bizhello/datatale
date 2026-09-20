import { describe, expect, it } from "vitest";
import { historyDetailSchema, restoreMessages } from "./history";

const base = {
  analysisId: "00000000-0000-4000-8000-000000000002",
  source: {
    version: 1 as const,
    id: "text-1",
    source: { kind: "text" as const },
    rawText: "One",
    paragraphs: [{ index: 1, text: "One" }],
  },
  report: {
    version: 1 as const,
    hero: [
      {
        text: "Observed",
        factIds: [],
        evidenceIds: ["e"],
        kind: "observation" as const,
      },
      {
        text: "Confirmed",
        factIds: [],
        evidenceIds: ["e"],
        kind: "observation" as const,
      },
    ],
    metrics: [],
    charts: [],
    evidence: [
      { id: "e", kind: "quote" as const, label: "Source", excerpt: "One" },
    ],
    recommendations: [],
    noChartReason: "No chart is needed.",
  },
  expiresAt: "2026-09-26T12:00:00.000Z",
};

describe("history hydration contract", () => {
  it("requires a validated result for every persisted assistant row", () => {
    expect(
      historyDetailSchema.safeParse({
        ...base,
        messages: [
          {
            id: "m:assistant",
            analysisId: base.analysisId,
            role: "assistant",
            content: "Unknown",
            createdAt: "2026-09-19T12:00:00.000Z",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps persisted user and assistant rows in sequence", () => {
    const messages = restoreMessages([
      {
        id: "m-1",
        analysisId: base.analysisId,
        role: "user",
        content: "Сколько строк?",
        createdAt: "2026-09-19T12:00:00.000Z",
      },
      {
        id: "m-1:assistant",
        analysisId: base.analysisId,
        role: "assistant",
        content: "Три строки.",
        result: {
          outcome: "answered",
          answer: "Три строки.",
          references: [{ id: "e" }],
        },
        createdAt: "2026-09-19T12:00:01.000Z",
      },
    ]);
    expect(messages.map((message) => message.text)).toEqual([
      "Сколько строк?",
      "Три строки.",
    ]);
  });

  it("restores clarification and absence as distinct assistant messages", () => {
    const common = {
      analysisId: base.analysisId,
      role: "assistant" as const,
      createdAt: "2026-09-19T12:00:01.000Z",
    };
    const messages = restoreMessages([
      {
        ...common,
        id: "clarification",
        content: "Уточните период.",
        result: {
          outcome: "clarification" as const,
          message: "Уточните период.",
        },
      },
      {
        ...common,
        id: "missing",
        content: "В этом отчете нет такой информации",
        result: {
          outcome: "not_in_source" as const,
          message: "В этом отчете нет такой информации" as const,
        },
      },
    ]);

    expect(messages).toEqual([
      expect.objectContaining({
        kind: "clarification",
        text: "Уточните период.",
      }),
      expect.objectContaining({
        kind: "not_in_source",
        text: "В этом отчете нет такой информации",
      }),
    ]);
  });
});
