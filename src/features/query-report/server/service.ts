import "server-only";
import { readFile } from "node:fs/promises";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CHAT_ANSWER_MAX_LENGTH, CHAT_HISTORY_MAX_MESSAGES, CHAT_HISTORY_MESSAGE_MAX_LENGTH, CHAT_REFUSAL, type ChatMessage, type ChatRequest, type ChatResult, chatRequestSchema, chatResultSchema } from "@/entities/chat";
import type { Dataset, DatasetColumn, TextSource } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";

export const CHAT_TIMEOUT_MS = 30_000;
const MAX_DISTINCT_VALUES = 40;
const MAX_PLAN_REPAIRS = 1;
const PROVIDER_OUTPUT_MAX_TOKENS = 900;

const metricSchema = z.object({ aggregation: z.enum(["count", "sum", "average", "min", "max", "distinctCount"]), field: z.string().min(1).max(160).optional() }).strict();
const filterSchema = z.object({ field: z.string().min(1).max(160), operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]), value: z.union([z.string(), z.number().finite(), z.boolean()]) }).strict();
export const sourceQueryPlanSchema = z.object({ filters: z.array(filterSchema).max(12), groupBy: z.array(z.string().min(1).max(160)).max(4), select: z.array(z.string().min(1).max(160)).max(12), metrics: z.array(metricSchema).max(8), orderBy: z.object({ field: z.string().min(1).max(160), direction: z.enum(["asc", "desc"]) }).strict().optional(), limit: z.number().int().min(1).max(100) }).strict();
export type SourceQueryPlan = z.infer<typeof sourceQueryPlanSchema>;
export type QueryResultReference = { id: string; excerpt?: string };
export type QueryResult = { rows: Array<Record<string, string | number | boolean | null>>; references: QueryResultReference[] };
export type QueryExecutor = { execute(plan: SourceQueryPlan, signal: AbortSignal): Promise<QueryResult> };
export type ChatContext = { analysisId: string; source: Dataset | TextSource; report: FinalReport; history: ChatMessage[] };
export type ChatProvider = (request: { prompt: string; signal: AbortSignal }) => Promise<unknown>;
export type ChatDependencies = { loadContext: (analysisId: string, signal: AbortSignal) => Promise<ChatContext | undefined>; provider?: ChatProvider; queryExecutor?: QueryExecutor; timeoutMs?: number; signal?: AbortSignal };

export class ChatProviderError extends Error {
  constructor(readonly code: "provider_timeout" | "provider_aborted" | "invalid_provider_output" | "provider_failure", message: string) { super(message); }
}
const clarification = (message = "Уточните, пожалуйста, что именно нужно найти в источнике."): ChatResult => ({ outcome: "clarification", message });
const notInSource = (): ChatResult => ({ outcome: "not_in_source", message: CHAT_REFUSAL });
const unsupported = (message = "Эта операция не поддерживается для данного источника."): ChatResult => ({ outcome: "unsupported_operation", message });
function boundedHistory(history: ChatMessage[]) { return history.slice(-CHAT_HISTORY_MAX_MESSAGES).map((message) => ({ role: message.role, content: message.content.slice(0, CHAT_HISTORY_MESSAGE_MAX_LENGTH) })); }
function sourceReferences(source: Dataset | TextSource): QueryResultReference[] {
  return "rows" in source ? source.rows.map((row, index) => ({ id: `row-${index}`, excerpt: Object.entries(row.values).map(([key, value]) => `${key}: ${String(value)}`).join("; ") })) : source.paragraphs.map((paragraph) => ({ id: `paragraph-${paragraph.index}`, excerpt: paragraph.text }));
}
function columns(source: Dataset) { return source.columns.map((column) => { const values = [...new Set(source.rows.map((row) => row.values[column.id]).filter((value): value is string | number | boolean => value !== null))]; return { id: column.id, label: column.label, scalarType: column.scalarType, unit: column.unit, ...(values.length <= MAX_DISTINCT_VALUES ? { values } : { values: [], candidateSearch: "available" }) }; }); }
function validateReferences(references: Array<{ id: string; excerpt?: string | undefined }>, allowed: Set<string>) { if (references.length < 1 || references.length > 7) throw new Error("Answer must cite source references."); const seen = new Set<string>(); return references.map((reference) => { if (seen.has(reference.id) || !allowed.has(reference.id)) throw new Error("Answer cited unknown or duplicate source reference."); seen.add(reference.id); return { id: reference.id, ...(reference.excerpt ? { excerpt: reference.excerpt.slice(0, 1_000) } : {}) }; }); }
const answerSchema = z.object({ outcome: z.literal("answer"), answer: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH), references: z.array(z.object({ id: z.string(), excerpt: z.string().optional() }).strict()).min(1).max(7) }).strict();
const intentSchema = z.discriminatedUnion("outcome", [z.object({ outcome: z.literal("clarification"), message: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH) }).strict(), z.object({ outcome: z.literal("not_in_source") }).strict(), z.object({ outcome: z.literal("unsupported_operation"), message: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH) }).strict(), z.object({ outcome: z.literal("query"), plan: sourceQueryPlanSchema }).strict()]);
const responseSchema = z.discriminatedUnion("outcome", [answerSchema, z.object({ outcome: z.literal("clarification"), message: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH) }).strict(), z.object({ outcome: z.literal("not_in_source") }).strict(), z.object({ outcome: z.literal("unsupported_operation"), message: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH) }).strict()]);
const repairSchema = z.object({ outcome: z.literal("query"), plan: sourceQueryPlanSchema }).strict();
function validatePlan(plan: SourceQueryPlan, source: Dataset) {
  const known = new Map(source.columns.map((column) => [column.id, column]));
  const fields = [...plan.select, ...plan.groupBy, ...(plan.orderBy ? [plan.orderBy.field] : []), ...plan.metrics.flatMap((metric) => metric.field ? [metric.field] : []), ...plan.filters.map((filter) => filter.field)];
  if (fields.some((field) => !known.has(field))) throw new Error("Query plan contains an unknown field.");
  for (const metric of plan.metrics) { if (metric.aggregation !== "count" && !metric.field) throw new Error("Metric requires a field."); if (metric.field && metric.aggregation !== "count" && known.get(metric.field)?.scalarType !== "number") throw new Error("Numeric metric requires a numeric field."); }
  for (const filter of plan.filters) { const column = known.get(filter.field) as DatasetColumn; if (["gt", "gte", "lt", "lte"].includes(filter.operator) && !["number", "date"].includes(column.scalarType)) throw new Error("Range filter requires a sortable field."); const candidateValues = source.rows.map((row) => row.values[filter.field]).filter((value) => value !== null); if (filter.operator === "eq" && candidateValues.length <= MAX_DISTINCT_VALUES && !candidateValues.some((value) => value === filter.value)) throw new Error("Filter value is absent from the source."); }
  return plan;
}
async function defaultProvider({ prompt, signal }: Parameters<ChatProvider>[0]) { const model = getAnalysisModel(); if (!model) throw new Error("Chat provider is not configured."); const promptFile = await readFile(new URL("./prompts/chat.md", import.meta.url), "utf8"); const response = await generateText({ model, output: Output.object({ schema: z.unknown() }), prompt: `${promptFile}\n\n${prompt}`, maxRetries: 0, maxOutputTokens: PROVIDER_OUTPUT_MAX_TOKENS, abortSignal: signal, timeout: CHAT_TIMEOUT_MS }); return response.output; }
async function callProvider(provider: ChatProvider, prompt: unknown, signal: AbortSignal) { return provider({ prompt: JSON.stringify(prompt), signal }); }

async function answerChatCore(request: ChatRequest, dependencies: ChatDependencies): Promise<ChatResult> {
  const signal = dependencies.signal ?? new AbortController().signal; if (signal.aborted) throw new ChatProviderError("provider_aborted", "Chat request was cancelled.");
  const parsed = chatRequestSchema.parse(request); let context: ChatContext | undefined;
  try { context = await dependencies.loadContext(parsed.analysisId, signal); } catch (error) { throw new ChatProviderError("provider_failure", error instanceof Error ? error.message : "Context loading failed."); }
  if (!context || context.analysisId !== parsed.analysisId) return notInSource();
  const provider = dependencies.provider ?? defaultProvider; const history = boundedHistory(context.history); const allowed = new Set(sourceReferences(context.source).map((reference) => reference.id));
  if (!("rows" in context.source)) {
    if (context.source.rawText.length > 30_000) return unsupported("Текстовый источник слишком велик для прямого чтения.");
    const raw = await callProvider(provider, { kind: "text", paragraphs: context.source.paragraphs.map((paragraph) => ({ id: `paragraph-${paragraph.index}`, text: paragraph.text })), question: parsed.question, history }, signal);
    try { const output = responseSchema.parse(raw); if (output.outcome === "answer") return chatResultSchema.parse({ outcome: "answered", answer: output.answer, references: validateReferences(output.references, allowed) }); if (output.outcome === "clarification") return clarification(output.message); if (output.outcome === "unsupported_operation") return unsupported(output.message); return notInSource(); } catch (error) { throw new ChatProviderError("invalid_provider_output", error instanceof Error ? error.message : "Provider returned invalid text answer."); }
  }
  if (!dependencies.queryExecutor) return unsupported("Операции с таблицей временно недоступны.");
  const profile = { kind: "dataset", columns: columns(context.source), rowCount: context.source.rows.length, question: parsed.question, history }; let intent: z.infer<typeof intentSchema>;
  const rawIntent = await callProvider(provider, profile, signal); try { intent = intentSchema.parse(rawIntent); } catch (error) { throw new ChatProviderError("invalid_provider_output", error instanceof Error ? error.message : "Provider returned invalid query intent."); }
  if (intent.outcome === "clarification") return clarification(intent.message); if (intent.outcome === "not_in_source") return notInSource(); if (intent.outcome === "unsupported_operation") return unsupported(intent.message);
  let plan = intent.plan;
  for (let attempt = 0; ; attempt += 1) { try { plan = validatePlan(plan, context.source); break; } catch (error) { if (attempt >= MAX_PLAN_REPAIRS) throw new ChatProviderError("invalid_provider_output", error instanceof Error ? error.message : "Invalid query plan."); try { plan = repairSchema.parse(await callProvider(provider, { kind: "repair", question: parsed.question, profile, invalidPlan: plan, error: error instanceof Error ? error.message : "Invalid plan" }, signal)).plan; } catch (repairError) { throw new ChatProviderError("invalid_provider_output", repairError instanceof Error ? repairError.message : "Invalid repaired query plan."); } } }
  let result: QueryResult; try { result = await dependencies.queryExecutor.execute(plan, signal); } catch (error) { if (signal.aborted) throw new ChatProviderError("provider_aborted", "Chat request was cancelled."); throw error; }
  const finalAllowed = new Set(result.references.map((reference) => reference.id));
  const rawAnswer = await callProvider(provider, { kind: "query-result", question: parsed.question, plan, rows: result.rows.slice(0, 100), references: result.references }, signal);
  try { const output = responseSchema.parse(rawAnswer); if (output.outcome === "answer") return chatResultSchema.parse({ outcome: "answered", answer: output.answer, references: validateReferences(output.references, finalAllowed) }); if (output.outcome === "clarification") return clarification(output.message); if (output.outcome === "unsupported_operation") return unsupported(output.message); return notInSource(); } catch (error) { throw new ChatProviderError("invalid_provider_output", error instanceof Error ? error.message : "Provider returned invalid query answer."); }
}
export async function answerChat(request: ChatRequest, dependencies: ChatDependencies): Promise<ChatResult> { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? CHAT_TIMEOUT_MS); const externalSignal = dependencies.signal; const abortExternal = () => controller.abort(); if (externalSignal?.aborted) controller.abort(); externalSignal?.addEventListener("abort", abortExternal, { once: true }); try { return await answerChatCore(request, { ...dependencies, signal: controller.signal }); } catch (error) { if (error instanceof ChatProviderError && error.code === "provider_aborted" && !externalSignal?.aborted) throw new ChatProviderError("provider_timeout", "Chat provider timed out."); if (controller.signal.aborted && !externalSignal?.aborted) throw new ChatProviderError("provider_timeout", "Chat provider timed out."); if (error instanceof ChatProviderError) throw error; throw new ChatProviderError("provider_failure", error instanceof Error ? error.message : "Chat provider failed."); } finally { clearTimeout(timer); externalSignal?.removeEventListener("abort", abortExternal); } }
