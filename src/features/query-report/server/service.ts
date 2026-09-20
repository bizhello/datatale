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

/* One flat, all-required envelope avoids oneOf/anyOf in the Spiro JSON schema. */
const providerEnvelopeSchema = z
  .object({
    outcome: z.enum([
      "answer",
      "clarification",
      "not_in_source",
      "unsupported_operation",
      "query",
    ]),
    answer: z.string().max(CHAT_ANSWER_MAX_LENGTH),
    message: z.string().max(CHAT_ANSWER_MAX_LENGTH),
    references: z
      .array(
        z
          .object({ id: z.string().max(160), excerpt: z.string().max(1_000) })
          .strict(),
      )
      .max(7),
    queryId: z.string().max(160),
    filters: z
      .array(
        z
          .object({
            fieldId: z.string().max(160),
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
            valueKind: z.enum([
              "string",
              "number",
              "boolean",
              "null",
              "string_list",
              "number_list",
              "boolean_list",
              "null_list",
            ]),
            values: z.array(z.string().max(160)).max(100),
          })
          .strict(),
      )
      .max(20),
    groupBy: z.string().max(160),
    select: z.array(z.string().max(160)).max(30),
    metrics: z
      .array(
        z
          .object({
            id: z.string().max(160),
            aggregation: z.enum([
              "count",
              "sum",
              "average",
              "min",
              "max",
              "distinctCount",
            ]),
            fieldId: z.string().max(160),
          })
          .strict(),
      )
      .max(20),
    orderBy: z
      .array(
        z
          .object({
            fieldId: z.string().max(160),
            metricId: z.string().max(160),
            direction: z.enum(["asc", "desc"]),
          })
          .strict()
          .refine(
            (value) => (value.fieldId === "") !== (value.metricId === ""),
            "Order must reference one field or metric.",
          ),
      )
      .max(20),
    limit: z.number().int().min(0).max(100),
  })
  .strict();
type ProviderEnvelope = z.output<typeof providerEnvelopeSchema>;
function decodeValue(
  filter: ProviderEnvelope["filters"][number],
): string | number | boolean | null | Array<string | number | boolean | null> {
  const list = filter.valueKind.endsWith("_list");
  if (
    (list && filter.values.length < 1) ||
    (!list && filter.values.length !== 1)
  )
    throw new Error("Filter valueKind and values do not agree.");
  const parse = (value: string): string | number | boolean | null => {
    if (filter.valueKind.startsWith("number")) {
      const number = Number(value);
      if (!Number.isFinite(number))
        throw new Error("Filter number is invalid.");
      return number;
    }
    if (filter.valueKind.startsWith("boolean")) {
      if (value !== "true" && value !== "false")
        throw new Error("Filter boolean is invalid.");
      return value === "true";
    }
    if (filter.valueKind.startsWith("null")) {
      if (value !== "") throw new Error("Filter null sentinel is invalid.");
      return null;
    }
    return value;
  };
  return list ? filter.values.map(parse) : parse(filter.values[0] as string);
}
function decodeQuery(input: ProviderEnvelope): DatasetQuery {
  if (input.outcome !== "query") throw new Error("Expected a query outcome.");
  if (
    !input.queryId ||
    !input.limit ||
    input.answer ||
    input.message ||
    input.references.length
  )
    throw new Error("Query outcome contains invalid sentinels.");
  return datasetQuerySchema.parse({
    queryId: input.queryId,
    filters: input.filters.map((filter) => ({
      fieldId: filter.fieldId,
      operator: filter.operator,
      value: decodeValue(filter),
    })),
    groupBy: input.groupBy ? { fieldId: input.groupBy } : undefined,
    select: input.select,
    metrics: input.metrics.map((metric) => ({
      ...metric,
      fieldId: metric.fieldId || undefined,
    })),
    orderBy: input.orderBy.map((order) => ({
      ...order,
      fieldId: order.fieldId || undefined,
      metricId: order.metricId || undefined,
    })),
    limit: input.limit,
  });
}
function decodeOutcome(raw: unknown): ProviderEnvelope {
  const output = providerEnvelopeSchema.parse(raw);
  if (
    output.outcome === "answer" &&
    (!output.answer.trim() || output.references.length === 0)
  )
    throw new Error("Answer outcome requires answer and references.");
  if (
    ["clarification", "unsupported_operation"].includes(output.outcome) &&
    !output.message.trim()
  )
    throw new Error("Message outcome requires a message.");
  if (
    output.outcome === "not_in_source" &&
    (output.answer || output.message || output.references.length)
  )
    throw new Error("Missing-source outcome contains invalid sentinels.");
  return output;
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
function columns(source: Dataset, question: string) {
  const normalizedQuestion = question.toLocaleLowerCase("ru-RU").trim();
  return source.columns.map((column) => {
    const counts = new Map<string | number | boolean, number>();
    for (const value of source.rows.map((row) => row.values[column.id])) {
      if (value !== null && value !== undefined)
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const values = [...counts.keys()];
    const frequent = values
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
      .slice(0, MAX_DISTINCT_VALUES);
    const questionCandidates = values.filter(
      (value): value is string =>
        typeof value === "string" &&
        (normalizedQuestion.includes(value.toLocaleLowerCase("ru-RU")) ||
          value.toLocaleLowerCase("ru-RU").includes(normalizedQuestion)),
    );
    const candidates = [...new Set([...questionCandidates, ...frequent])].slice(
      0,
      MAX_DISTINCT_VALUES,
    );
    return {
      id: column.id,
      label: column.label,
      scalarType: column.scalarType,
      ...(column.unit ? { unit: column.unit } : {}),
      values: candidates,
      ...(values.length > MAX_DISTINCT_VALUES
        ? { candidateCount: values.length }
        : {}),
    };
  });
}
function validateReferences(
  references: Array<{ id: string; excerpt?: string | undefined }>,
  evidence: Map<string, string>,
  requiredId?: string,
) {
  if (references.length < 1 || references.length > 7)
    throw new Error("Answer must cite source references.");
  const seen = new Set<string>();
  const result = references.map((reference) => {
    if (seen.has(reference.id) || !evidence.has(reference.id))
      throw new Error("Answer cited unknown or duplicate source reference.");
    seen.add(reference.id);
    return {
      id: reference.id,
      excerpt: evidence.get(reference.id) as string,
    };
  });
  if (requiredId && !seen.has(requiredId))
    throw new Error("Numeric answer must cite the query result reference.");
  return result;
}
function fieldId(field: string | { fieldId: string }) {
  return typeof field === "string" ? field : field.fieldId;
}
function validateQuery(query: DatasetQuery, source: Dataset): DatasetQuery {
  const parsed = datasetQuerySchema.parse(query);
  if (parsed.limit > 100)
    throw new Error("Chat query limit exceeds the provider evidence bound.");
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
    output: Output.object({ schema: providerEnvelopeSchema }),
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
      excerpt: `Метрики: ${JSON.stringify(result.metrics)}; найдено строк: ${result.matchedRows}; просмотрено строк: ${result.scannedRows}.`,
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
  const allowed = new Map(
    sourceReferences(context.source).map((reference) => [
      reference.id,
      reference.excerpt ?? "",
    ]),
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
      const output = decodeOutcome(raw);
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
    columns: columns(context.source, parsed.question),
    rowCount: context.source.rows.length,
    question: parsed.question,
    history,
  };
  let intent: ProviderEnvelope;
  try {
    intent = decodeOutcome(await callProvider(provider, profile, signal));
  } catch (error) {
    throw new ChatProviderError(
      "invalid_provider_output",
      error instanceof Error
        ? error.message
        : "Provider returned invalid query intent.",
    );
  }
  if (intent.outcome === "clarification") return clarification(intent.message);
  if (intent.outcome === "not_in_source")
    throw new ChatProviderError(
      "invalid_provider_output",
      "Dataset absence requires an executed query.",
    );
  if (intent.outcome === "unsupported_operation")
    return unsupported(intent.message);
  let query: DatasetQuery = decodeQuery(intent);
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
        query = decodeQuery(
          decodeOutcome(
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
  const finalAllowed = new Map(
    references.map((reference) => [reference.id, reference.excerpt ?? ""]),
  );
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
      matchedRows: result.matchedRows,
      scannedRows: result.scannedRows,
      returnedRows: result.returnedRows,
      truncated: result.truncated,
      references,
    },
    signal,
  );
  try {
    const output = decodeOutcome(rawAnswer);
    if (output.outcome === "answer")
      return chatResultSchema.parse({
        outcome: "answered",
        answer: output.answer,
        references: validateReferences(
          output.references,
          finalAllowed,
          Object.keys(result.metrics).length > 0
            ? `query-${result.queryId}`
            : undefined,
        ),
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
