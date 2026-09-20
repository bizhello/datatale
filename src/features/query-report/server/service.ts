import "server-only";
import { readFile } from "node:fs/promises";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  CHAT_ANSWER_MAX_LENGTH,
  CHAT_HISTORY_MAX_MESSAGES,
  CHAT_HISTORY_MESSAGE_MAX_LENGTH,
  CHAT_REFUSAL,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  chatRequestSchema,
  chatResultSchema,
} from "@/entities/chat";
import {
  type Dataset,
  type DatasetQuery,
  type DatasetQueryResult,
  datasetQuerySchema,
  type TextSource,
} from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";

export const CHAT_TIMEOUT_MS = 30_000;
const MAX_DISTINCT_VALUES = 40;
const MAX_PLAN_REPAIRS = 1;
const PROVIDER_OUTPUT_MAX_TOKENS = 900;

/** Query validation and result shape are owned by the dataset entity. */
export const sourceQueryPlanSchema = datasetQuerySchema;
export type SourceQueryPlan = DatasetQuery;
export type QueryResult = DatasetQueryResult;
export type QueryResultReference = { id: string; excerpt?: string };
export type QueryExecutor = {
  execute(
    dataset: Dataset,
    query: DatasetQuery,
    signal: AbortSignal,
  ): Promise<DatasetQueryResult>;
};
export type ChatContext = {
  analysisId: string;
  source: Dataset | TextSource;
  report: FinalReport;
  history: ChatMessage[];
};
export type ChatProvider = (request: {
  prompt: string;
  signal: AbortSignal;
}) => Promise<unknown>;
export type ChatDependencies = {
  loadContext: (
    analysisId: string,
    signal: AbortSignal,
  ) => Promise<ChatContext | undefined>;
  provider?: ChatProvider;
  queryExecutor?: QueryExecutor;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class ChatProviderError extends Error {
  constructor(
    readonly code:
      | "provider_timeout"
      | "provider_aborted"
      | "invalid_provider_output"
      | "provider_failure",
    message: string,
  ) {
    super(message);
  }
}

const answerSchema = z
  .object({
    outcome: z.literal("answer"),
    answer: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH),
    references: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            excerpt: z.string().max(1_000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(7),
  })
  .strict();
const clarificationSchema = z
  .object({
    outcome: z.literal("clarification"),
    message: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH),
  })
  .strict();
const notInSourceSchema = z
  .object({ outcome: z.literal("not_in_source") })
  .strict();
const unsupportedSchema = z
  .object({
    outcome: z.literal("unsupported_operation"),
    message: z.string().min(1).max(CHAT_ANSWER_MAX_LENGTH),
  })
  .strict();

/* Provider messages are flat and all fields are required for stable gateway JSON schema. */
const wireValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z
    .array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()]))
    .min(1)
    .max(100),
]);
const providerQuerySchema = z
  .object({
    outcome: z.literal("query"),
    queryId: z.string().min(1).max(160),
    filters: z
      .array(
        z
          .object({
            fieldId: z.string().min(1).max(160),
            operator: z.enum([
              "eq",
              "ne",
              "in",
              "lt",
              "lte",
              "gt",
              "gte",
              "contains",
            ]),
            value: wireValueSchema,
          })
          .strict(),
      )
      .max(20),
    groupBy: z.string().min(1).max(160).nullable(),
    select: z.array(z.string().min(1).max(160)).max(30),
    metrics: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            aggregation: z.enum([
              "count",
              "sum",
              "average",
              "min",
              "max",
              "distinctCount",
            ]),
            fieldId: z.string().min(1).max(160).nullable(),
          })
          .strict(),
      )
      .max(20),
    orderBy: z
      .array(
        z
          .object({
            fieldId: z.string().min(1).max(160).nullable(),
            metricId: z.string().min(1).max(160).nullable(),
            direction: z.enum(["asc", "desc"]),
          })
          .strict()
          .refine(
            (value) => (value.fieldId === null) !== (value.metricId === null),
            "Order must reference one field or metric.",
          ),
      )
      .max(20),
    limit: z.number().int().min(1).max(1_000),
  })
  .strict();
const providerIntentSchema = z.discriminatedUnion("outcome", [
  clarificationSchema,
  notInSourceSchema,
  unsupportedSchema,
  providerQuerySchema,
]);
const providerResponseSchema = z.discriminatedUnion("outcome", [
  answerSchema,
  clarificationSchema,
  notInSourceSchema,
  unsupportedSchema,
]);
const providerOutputSchema = z.discriminatedUnion("outcome", [
  answerSchema,
  clarificationSchema,
  notInSourceSchema,
  unsupportedSchema,
  providerQuerySchema,
]);
function normalizeProviderQuery(
  input: z.output<typeof providerQuerySchema>,
): DatasetQuery {
  return datasetQuerySchema.parse({
    queryId: input.queryId,
    filters: input.filters,
    groupBy: input.groupBy === null ? undefined : { fieldId: input.groupBy },
    select: input.select,
    metrics: input.metrics.map((metric) => ({
      ...metric,
      fieldId: metric.fieldId === null ? undefined : metric.fieldId,
    })),
    orderBy: input.orderBy.map((order) => ({
      ...order,
      fieldId: order.fieldId === null ? undefined : order.fieldId,
      metricId: order.metricId === null ? undefined : order.metricId,
    })),
    limit: input.limit,
  });
}

const clarification = (
  message = "Уточните, пожалуйста, что именно нужно найти в источнике.",
): ChatResult => ({ outcome: "clarification", message });
const notInSource = (): ChatResult => ({
  outcome: "not_in_source",
  message: CHAT_REFUSAL,
});
const unsupported = (
  message = "Эта операция не поддерживается для данного источника.",
): ChatResult => ({ outcome: "unsupported_operation", message });

function boundedHistory(history: ChatMessage[]) {
  return history.slice(-CHAT_HISTORY_MAX_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, CHAT_HISTORY_MESSAGE_MAX_LENGTH),
  }));
}
function rowExcerpt(row: { values: Record<string, unknown> }) {
  return Object.entries(row.values)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");
}
function sourceReferences(
  source: Dataset | TextSource,
): QueryResultReference[] {
  return "rows" in source
    ? source.rows.map((row) => ({
        id: `row-${row.id}`,
        excerpt: rowExcerpt(row),
      }))
    : source.paragraphs.map((paragraph) => ({
        id: `paragraph-${paragraph.index}`,
        excerpt: paragraph.text,
      }));
}
function columns(source: Dataset) {
  return source.columns.map((column) => {
    const values = [
      ...new Set(
        source.rows
          .map((row) => row.values[column.id])
          .filter(
            (value): value is string | number | boolean => value !== null,
          ),
      ),
    ];
    return {
      id: column.id,
      label: column.label,
      scalarType: column.scalarType,
      ...(column.unit ? { unit: column.unit } : {}),
      ...(values.length <= MAX_DISTINCT_VALUES
        ? { values }
        : { values: [], candidateSearch: "available" }),
    };
  });
}
function validateReferences(
  references: Array<{ id: string; excerpt?: string | undefined }>,
  allowed: Set<string>,
) {
  if (references.length < 1 || references.length > 7)
    throw new Error("Answer must cite source references.");
  const seen = new Set<string>();
  return references.map((reference) => {
    if (seen.has(reference.id) || !allowed.has(reference.id))
      throw new Error("Answer cited unknown or duplicate source reference.");
    seen.add(reference.id);
    return {
      id: reference.id,
      ...(reference.excerpt
        ? { excerpt: reference.excerpt.slice(0, 1_000) }
        : {}),
    };
  });
}
function fieldId(field: string | { fieldId: string }) {
  return typeof field === "string" ? field : field.fieldId;
}
function validateQuery(query: DatasetQuery, source: Dataset): DatasetQuery {
  const parsed = datasetQuerySchema.parse(query);
  const fields = [
    ...parsed.select.map(fieldId),
    ...(parsed.groupBy ? [fieldId(parsed.groupBy)] : []),
    ...parsed.filters.map((filter) => filter.fieldId),
    ...parsed.metrics.flatMap((metric) =>
      metric.fieldId ? [metric.fieldId] : [],
    ),
    ...parsed.orderBy.flatMap((order) =>
      order.fieldId ? [order.fieldId] : [],
    ),
  ];
  const known = new Map(source.columns.map((column) => [column.id, column]));
  for (const field of fields)
    if (!known.has(field))
      throw new Error(`Query contains unknown field "${field}".`);
  for (const metric of parsed.metrics) {
    if (metric.aggregation !== "count" && !metric.fieldId)
      throw new Error("Metric requires a field.");
    if (
      metric.fieldId &&
      metric.aggregation !== "count" &&
      metric.aggregation !== "distinctCount" &&
      known.get(metric.fieldId)?.scalarType !== "number"
    )
      throw new Error("Numeric metric requires a numeric field.");
  }
  return parsed;
}
async function defaultProvider({
  prompt,
  signal,
}: Parameters<ChatProvider>[0]) {
  const model = getAnalysisModel();
  if (!model) throw new Error("Chat provider is not configured.");
  const promptFile = await readFile(
    new URL("./prompts/chat.md", import.meta.url),
    "utf8",
  );
  const response = await generateText({
    model,
    output: Output.object({ schema: providerOutputSchema }),
    prompt: `${promptFile}\n\n${prompt}`,
    maxRetries: 0,
    maxOutputTokens: PROVIDER_OUTPUT_MAX_TOKENS,
    abortSignal: signal,
    timeout: CHAT_TIMEOUT_MS,
  });
  return response.output;
}
async function callProvider(
  provider: ChatProvider,
  prompt: unknown,
  signal: AbortSignal,
) {
  return provider({ prompt: JSON.stringify(prompt), signal });
}
function resultReferences(
  result: DatasetQueryResult,
  source: Dataset,
): QueryResultReference[] {
  const rows = new Map(source.rows.map((row) => [row.id, row]));
  const references: QueryResultReference[] = [
    {
      id: `query-${result.queryId}`,
      excerpt: `Найдено строк: ${result.matchedRows}; просмотрено строк: ${result.scannedRows}.`,
    },
  ];
  const seen = new Set<string>();
  for (const reference of [
    ...result.rowReferences,
    ...result.groups.flatMap((group) => group.rowReferences),
  ]) {
    if (seen.has(reference.rowId)) continue;
    const row = rows.get(reference.rowId);
    if (!row) continue;
    seen.add(reference.rowId);
    references.push({ id: `row-${row.id}`, excerpt: rowExcerpt(row) });
    if (references.length >= 100) break;
  }
  return references;
}
function derivedEvidence(result: DatasetQueryResult) {
  const derived: Array<Record<string, string | number>> = [];
  for (const [metricId, total] of Object.entries(result.metrics)) {
    if (total === null || !Number.isFinite(total)) continue;
    let previous: number | null = null;
    for (const [index, group] of result.groups.entries()) {
      const value = group.metrics[metricId];
      if (value === null || value === undefined || !Number.isFinite(value)) {
        previous = null;
        continue;
      }
      const item: Record<string, string | number> = {
        metricId,
        groupIndex: index,
        value,
        shareOfTotal: total === 0 ? 0 : (value / total) * 100,
      };
      if (previous !== null) {
        item.differenceFromPrevious = value - previous;
        item.percentChangeFromPrevious =
          previous === 0 ? 0 : ((value - previous) / Math.abs(previous)) * 100;
      }
      derived.push(item);
      previous = value;
    }
  }
  return derived;
}

async function answerChatCore(
  request: ChatRequest,
  dependencies: ChatDependencies,
): Promise<ChatResult> {
  const signal = dependencies.signal ?? new AbortController().signal;
  if (signal.aborted)
    throw new ChatProviderError(
      "provider_aborted",
      "Chat request was cancelled.",
    );
  const parsed = chatRequestSchema.parse(request);
  let context: ChatContext | undefined;
  try {
    context = await dependencies.loadContext(parsed.analysisId, signal);
  } catch (error) {
    throw new ChatProviderError(
      "provider_failure",
      error instanceof Error ? error.message : "Context loading failed.",
    );
  }
  if (!context || context.analysisId !== parsed.analysisId)
    return notInSource();
  const provider = dependencies.provider ?? defaultProvider;
  const history = boundedHistory(context.history);
  const allowed = new Set(
    sourceReferences(context.source).map((reference) => reference.id),
  );
  if (!("rows" in context.source)) {
    if (context.source.rawText.length > 30_000)
      return unsupported(
        "Текстовый источник слишком велик для прямого чтения.",
      );
    const raw = await callProvider(
      provider,
      {
        kind: "text",
        paragraphs: context.source.paragraphs.map((paragraph) => ({
          id: `paragraph-${paragraph.index}`,
          text: paragraph.text,
        })),
        question: parsed.question,
        history,
      },
      signal,
    );
    try {
      const output = providerResponseSchema.parse(raw);
      if (output.outcome === "answer")
        return chatResultSchema.parse({
          outcome: "answered",
          answer: output.answer,
          references: validateReferences(output.references, allowed),
        });
      if (output.outcome === "clarification")
        return clarification(output.message);
      if (output.outcome === "unsupported_operation")
        return unsupported(output.message);
      return notInSource();
    } catch (error) {
      throw new ChatProviderError(
        "invalid_provider_output",
        error instanceof Error
          ? error.message
          : "Provider returned invalid text answer.",
      );
    }
  }
  if (!dependencies.queryExecutor)
    return unsupported("Операции с таблицей временно недоступны.");
  const profile = {
    kind: "dataset",
    columns: columns(context.source),
    rowCount: context.source.rows.length,
    question: parsed.question,
    history,
  };
  let intent: z.infer<typeof providerIntentSchema>;
  try {
    intent = providerIntentSchema.parse(
      await callProvider(provider, profile, signal),
    );
  } catch (error) {
    throw new ChatProviderError(
      "invalid_provider_output",
      error instanceof Error
        ? error.message
        : "Provider returned invalid query intent.",
    );
  }
  if (intent.outcome === "clarification") return clarification(intent.message);
  if (intent.outcome === "not_in_source") return notInSource();
  if (intent.outcome === "unsupported_operation")
    return unsupported(intent.message);
  let query: DatasetQuery = normalizeProviderQuery(intent);
  for (let attempt = 0; ; attempt += 1) {
    try {
      query = validateQuery(query, context.source);
      break;
    } catch (error) {
      if (attempt >= MAX_PLAN_REPAIRS)
        throw new ChatProviderError(
          "invalid_provider_output",
          error instanceof Error ? error.message : "Invalid query plan.",
        );
      try {
        query = normalizeProviderQuery(
          providerQuerySchema.parse(
            await callProvider(
              provider,
              {
                kind: "repair",
                question: parsed.question,
                profile,
                invalidQuery: query,
                error: error instanceof Error ? error.message : "Invalid query",
              },
              signal,
            ),
          ),
        );
      } catch (repairError) {
        throw new ChatProviderError(
          "invalid_provider_output",
          repairError instanceof Error
            ? repairError.message
            : "Invalid repaired query plan.",
        );
      }
    }
  }
  let result: DatasetQueryResult;
  try {
    result = await dependencies.queryExecutor.execute(
      context.source,
      query,
      signal,
    );
  } catch (error) {
    if (signal.aborted)
      throw new ChatProviderError(
        "provider_aborted",
        "Chat request was cancelled.",
      );
    throw error;
  }
  const references = resultReferences(result, context.source);
  const finalAllowed = new Set(references.map((reference) => reference.id));
  const rawAnswer = await callProvider(
    provider,
    {
      kind: "query-result",
      question: parsed.question,
      query,
      rows: result.rows.slice(0, 100),
      groups: result.groups.slice(0, 100).map((group) => ({
        ...group,
        rowReferences: group.rowReferences.slice(0, 5),
      })),
      metrics: result.metrics,
      derived: derivedEvidence(result),
      matchedRows: result.matchedRows,
      scannedRows: result.scannedRows,
      returnedRows: result.returnedRows,
      truncated: result.truncated,
      references,
    },
    signal,
  );
  try {
    const output = providerResponseSchema.parse(rawAnswer);
    if (output.outcome === "answer")
      return chatResultSchema.parse({
        outcome: "answered",
        answer: output.answer,
        references: validateReferences(output.references, finalAllowed),
      });
    if (output.outcome === "clarification")
      return clarification(output.message);
    if (output.outcome === "unsupported_operation")
      return unsupported(output.message);
    return notInSource();
  } catch (error) {
    throw new ChatProviderError(
      "invalid_provider_output",
      error instanceof Error
        ? error.message
        : "Provider returned invalid query answer.",
    );
  }
}

export async function answerChat(
  request: ChatRequest,
  dependencies: ChatDependencies,
): Promise<ChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? CHAT_TIMEOUT_MS,
  );
  const externalSignal = dependencies.signal;
  const abortExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener("abort", abortExternal, { once: true });
  try {
    return await answerChatCore(request, {
      ...dependencies,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      error instanceof ChatProviderError &&
      error.code === "provider_aborted" &&
      !externalSignal?.aborted
    )
      throw new ChatProviderError(
        "provider_timeout",
        "Chat provider timed out.",
      );
    if (controller.signal.aborted && !externalSignal?.aborted)
      throw new ChatProviderError(
        "provider_timeout",
        "Chat provider timed out.",
      );
    if (error instanceof ChatProviderError) throw error;
    throw new ChatProviderError(
      "provider_failure",
      error instanceof Error ? error.message : "Chat provider failed.",
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortExternal);
  }
}
