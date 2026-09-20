import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Dataset, TextSource } from "@/entities/dataset";
import { answerChat, type ChatContext } from "./service";

const request = {
  analysisId: "00000000-0000-4000-8000-000000000002",
  messageId: "123e4567-e89b-12d3-a456-426614174000",
  question: "Что известно?",
};
const report = {
  version: 1,
  hero: [],
  metrics: [],
  charts: [],
  evidence: [],
  recommendations: [],
  noChartReason: "none",
} as const;
const text: TextSource = {
  version: 1,
  id: "text",
  source: { kind: "text" },
  rawText: "Краснодарская команда победила.",
  paragraphs: [{ index: 1, text: "Краснодарская команда победила." }],
};
const dataset: Dataset = {
  version: 1,
  id: "sales",
  source: { kind: "csv" },
  columns: [
    { id: "city", label: "Город", scalarType: "string" },
    { id: "sales", label: "Продажи", scalarType: "number" },
  ],
  rows: [
    {
      id: "r1",
      values: { city: "Краснодар", sales: 10 },
      provenance: { sourceRowNumber: 2 },
    },
  ],
};
function context(source: Dataset | TextSource): ChatContext {
  return {
    analysisId: request.analysisId,
    source,
    report: report as never,
    history: [],
  };
}

describe("planned grounded chat", () => {
  it("gives a text model the complete indexed source and validates paragraph citations", async () => {
    const provider = vi.fn(async ({ prompt }: { prompt: string }) => {
      expect(JSON.parse(prompt).paragraphs).toEqual([
        { id: "paragraph-1", text: text.paragraphs[0]?.text },
      ]);
      return {
        outcome: "answer",
        answer: "Команда победила.",
        references: [{ id: "paragraph-1" }],
      };
    });
    await expect(
      answerChat(request, { loadContext: async () => context(text), provider }),
    ).resolves.toEqual({
      outcome: "answered",
      answer: "Команда победила.",
      references: [{ id: "paragraph-1" }],
    });
  });
  it("executes a model plan and grounds the second call in query references", async () => {
    const executor = {
      execute: vi.fn(async (_dataset, query) => {
        expect(query.filters[0]).toMatchObject({
          fieldId: "city",
          operator: "eq",
          value: "Краснодар",
        });
        return {
          queryId: "chat",
          rows: [{ city: "Краснодар", sales: 10 }],
          groups: [],
          metrics: { total: 10 },
          matchedRows: 1,
          scannedRows: 1,
          returnedRows: 1,
          truncated: false,
          rowReferences: [{ rowId: "r1", sourceRowNumber: 2 }],
        };
      }),
    };
    const provider = vi
      .fn()
      .mockResolvedValueOnce({
        outcome: "query",
        queryId: "chat",
        filters: [{ fieldId: "city", operator: "eq", value: "Краснодар" }],
        groupBy: null,
        select: ["city", "sales"],
        metrics: [{ id: "total", aggregation: "sum", fieldId: "sales" }],
        orderBy: [],
        limit: 10,
      })
      .mockResolvedValueOnce({
        outcome: "answer",
        answer: "Продажи: 10.",
        references: [{ id: "row-r1" }],
      });
    await expect(
      answerChat(
        { ...request, question: "Продажи в Краснодаре" },
        {
          loadContext: async () => context(dataset),
          provider,
          queryExecutor: executor,
        },
      ),
    ).resolves.toMatchObject({ outcome: "answered", answer: "Продажи: 10." });
    expect(provider).toHaveBeenCalledTimes(2);
    expect(executor.execute).toHaveBeenCalledOnce();
  });
  it("repairs one invalid field plan and rejects invalid citations", async () => {
    const executor = {
      execute: vi.fn(async () => ({
        queryId: "chat",
        rows: [{ city: "Краснодар" }],
        groups: [],
        metrics: {},
        matchedRows: 1,
        scannedRows: 1,
        returnedRows: 1,
        truncated: false,
        rowReferences: [{ rowId: "r1", sourceRowNumber: 2 }],
      })),
    };
    const provider = vi
      .fn()
      .mockResolvedValueOnce({
        outcome: "query",
        queryId: "chat",
        filters: [],
        groupBy: null,
        select: ["unknown"],
        metrics: [],
        orderBy: [],
        limit: 1,
      })
      .mockResolvedValueOnce({
        outcome: "query",
        queryId: "chat",
        filters: [],
        groupBy: undefined,
        select: ["city"],
        metrics: [],
        orderBy: [],
        limit: 1,
      })
      .mockResolvedValueOnce({
        outcome: "answer",
        answer: "Да",
        references: [{ id: "missing" }],
      });
    await expect(
      answerChat(request, {
        loadContext: async () => context(dataset),
        provider,
        queryExecutor: executor,
      }),
    ).rejects.toMatchObject({ code: "invalid_provider_output" });
  });
});
