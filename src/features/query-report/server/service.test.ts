import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Dataset, TextSource } from "@/entities/dataset";
import { answerChat, type ChatContext } from "./service";

const request = { analysisId: "00000000-0000-4000-8000-000000000002", messageId: "123e4567-e89b-12d3-a456-426614174000", question: "Что известно?" };
const report = { version: 1, hero: [], metrics: [], charts: [], evidence: [], recommendations: [], noChartReason: "none" } as const;
const text: TextSource = { version: 1, id: "text", source: { kind: "text" }, rawText: "Краснодарская команда победила.", paragraphs: [{ index: 1, text: "Краснодарская команда победила." }] };
const dataset: Dataset = { version: 1, id: "sales", source: { kind: "csv" }, columns: [{ id: "city", label: "Город", scalarType: "string" }, { id: "sales", label: "Продажи", scalarType: "number" }], rows: [{ id: "r1", values: { city: "Краснодар", sales: 10 }, provenance: { sourceRowNumber: 2 } }] };
function context(source: Dataset | TextSource): ChatContext { return { analysisId: request.analysisId, source, report: report as never, history: [] }; }

describe("planned grounded chat", () => {
  it("gives a text model the complete indexed source and validates paragraph citations", async () => {
    const provider = vi.fn(async ({ prompt }: { prompt: string }) => { expect(JSON.parse(prompt).paragraphs).toEqual([{ id: "paragraph-1", text: text.paragraphs[0]?.text }]); return { outcome: "answer", answer: "Команда победила.", references: [{ id: "paragraph-1" }] }; });
    await expect(answerChat(request, { loadContext: async () => context(text), provider })).resolves.toEqual({ outcome: "answered", answer: "Команда победила.", references: [{ id: "paragraph-1" }] });
  });
  it("executes a model plan and grounds the second call in query references", async () => {
    const executor = { execute: vi.fn(async (plan) => { expect(plan.filters[0]).toMatchObject({ field: "city", operator: "eq", value: "Краснодар" }); return { rows: [{ city: "Краснодар", total: 10 }], references: [{ id: "row-0" }] }; }) };
    const provider = vi.fn().mockResolvedValueOnce({ outcome: "query", plan: { filters: [{ field: "city", operator: "eq", value: "Краснодар" }], groupBy: [], select: ["city"], metrics: [{ aggregation: "sum", field: "sales" }], limit: 10 } }).mockResolvedValueOnce({ outcome: "answer", answer: "Продажи: 10.", references: [{ id: "row-0" }] });
    await expect(answerChat({ ...request, question: "Продажи в Краснодаре" }, { loadContext: async () => context(dataset), provider, queryExecutor: executor })).resolves.toMatchObject({ outcome: "answered", answer: "Продажи: 10." });
    expect(provider).toHaveBeenCalledTimes(2); expect(executor.execute).toHaveBeenCalledOnce();
  });
  it("repairs one invalid field plan and rejects invalid citations", async () => {
    const executor = { execute: vi.fn(async () => ({ rows: [{ total: 10 }], references: [{ id: "row-0" }] })) };
    const provider = vi.fn().mockResolvedValueOnce({ outcome: "query", plan: { filters: [], groupBy: [], select: ["unknown"], metrics: [], limit: 1 } }).mockResolvedValueOnce({ outcome: "query", plan: { filters: [], groupBy: [], select: ["city"], metrics: [], limit: 1 } }).mockResolvedValueOnce({ outcome: "answer", answer: "Да", references: [{ id: "missing" }] });
    await expect(answerChat(request, { loadContext: async () => context(dataset), provider, queryExecutor: executor })).rejects.toMatchObject({ code: "invalid_provider_output" });
  });
});
