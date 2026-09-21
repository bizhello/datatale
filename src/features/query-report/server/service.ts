import "server-only";
import { readFile } from "node:fs/promises";
import { generateText, Output } from "ai";
import {
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
  validateDatasetQuery,
} from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";
import { validateAnswerReferences } from "./answer-validation";
import {
  decodeOutcome,
  decodeQuery,
  type ProviderEnvelope,
  providerEnvelopeSchema,
  providerQueryEnvelopeSchema,
} from "./provider-contract";
import {
  boundedHistory as buildBoundedHistory,
  columns as buildColumns,
  resultReferences as buildResultReferences,
  sourceReferences as buildSourceReferences,
  textEvidence as buildTextEvidence,
} from "./source-context";

export const CHAT_TIMEOUT_MS = 60_000;
const MAX_PLAN_REPAIRS = 1;
const MAX_FINAL_REPAIRS = 1;
const PROVIDER_OUTPUT_MAX_TOKENS = 900;

/** Query validation and result shape are owned by the dataset entity. */
export const sourceQueryPlanSchema = datasetQuerySchema;
export type SourceQueryPlan = DatasetQuery;
export type QueryResult = DatasetQueryResult;
export type { QueryResultReference } from "./source-context";
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
  output: "outcome" | "query";
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

function fieldId(field: string | { fieldId: string }) {
  return typeof field === "string" ? field : field.fieldId;
}
function validateQuery(
  query: DatasetQuery,
  source: Dataset,
  _question: string,
): DatasetQuery {
  const parsed = datasetQuerySchema.parse(query);
  validateDatasetQuery(source, parsed);
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
  if (
    parsed.purpose === "lookup" &&
    parsed.filters.length === 0 &&
    !parsed.groupBy
  )
    throw new Error(
      "An existence question must filter or group the requested entity; an unfiltered row count cannot prove presence or absence.",
    );
  return parsed;
}
async function defaultProvider({
  prompt,
  signal,
  output,
}: Parameters<ChatProvider>[0]) {
  const model = getAnalysisModel();
  if (!model) throw new Error("Chat provider is not configured.");
  const promptFile = await readFile(
    new URL("./prompts/chat.md", import.meta.url),
    "utf8",
  );
  const response = await generateText({
    model,
    output: Output.object({
      schema:
        output === "query"
          ? providerQueryEnvelopeSchema
          : providerEnvelopeSchema,
    }),
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
  output: "outcome" | "query" = "outcome",
) {
  try {
    return await provider({ prompt: JSON.stringify(prompt), signal, output });
  } catch (error) {
    if (signal.aborted)
      throw new ChatProviderError(
        "provider_aborted",
        "Chat request was cancelled.",
      );
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        (error.cause instanceof Error && error.cause.name === "TimeoutError"))
    )
      throw new ChatProviderError(
        "provider_timeout",
        "Chat provider timed out.",
      );
    throw new ChatProviderError(
      "provider_failure",
      error instanceof Error ? error.message : "Chat provider failed.",
    );
  }
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
  if (signal.aborted)
    throw new ChatProviderError(
      "provider_aborted",
      "Chat request was cancelled.",
    );
  if (!context || context.analysisId !== parsed.analysisId)
    return notInSource();
  const provider = dependencies.provider ?? defaultProvider;
  const history = buildBoundedHistory(context.history);
  const allowed = new Map(
    buildSourceReferences(context.source).map((reference) => [
      reference.id,
      reference,
    ]),
  );
  if (!("rows" in context.source)) {
    if (context.source.rawText.length > 30_000)
      return unsupported(
        "Текстовый источник слишком велик для прямого чтения.",
      );
    let raw = await callProvider(
      provider,
      {
        kind: "text",
        paragraphs: buildTextEvidence(context.source),
        question: parsed.question,
        history,
      },
      signal,
    );
    for (let attempt = 0; ; attempt += 1) {
      try {
        const output = decodeOutcome(raw);
        if (output.outcome === "answer")
          return chatResultSchema.parse({
            outcome: "answered",
            answer: output.answer,
            references: validateAnswerReferences(
              output.answer,
              output.references,
              allowed,
              undefined,
              {
                kind: output.calculationKind,
                referenceIds: output.calculationReferenceIds,
                values: output.calculationValues,
                result: output.calculationResult,
                unit: output.calculationUnit,
              },
            ),
          });
        if (output.outcome === "clarification")
          return clarification(output.message);
        if (output.outcome === "unsupported_operation")
          return unsupported(output.message);
        if (output.outcome === "query")
          throw new Error("Query outcome is invalid for a text answer.");
        return notInSource();
      } catch (error) {
        if (attempt >= MAX_FINAL_REPAIRS)
          throw new ChatProviderError(
            "invalid_provider_output",
            error instanceof Error
              ? error.message
              : "Provider returned invalid text answer.",
          );
        raw = await callProvider(
          provider,
          {
            kind: "answer-repair",
            question: parsed.question,
            source: buildTextEvidence(context.source),
            invalidAnswer: raw,
            error: error instanceof Error ? error.message : "Invalid answer",
          },
          signal,
        );
      }
    }
  }
  if (!dependencies.queryExecutor)
    return unsupported("Операции с таблицей временно недоступны.");
  const profile = {
    kind: "dataset",
    columns: buildColumns(context.source, parsed.question, history),
    rowCount: context.source.rows.length,
    question: parsed.question,
    history,
  };
  let intent: ProviderEnvelope;
  try {
    intent = decodeOutcome(await callProvider(provider, profile, signal));
  } catch (error) {
    if (error instanceof ChatProviderError) throw error;
    throw new ChatProviderError(
      "invalid_provider_output",
      error instanceof Error
        ? error.message
        : "Provider returned invalid query intent.",
    );
  }
  if (intent.outcome === "clarification") return clarification(intent.message);
  if (intent.outcome === "unsupported_operation")
    return unsupported(intent.message);
  let query: DatasetQuery;
  let candidate = intent;
  for (let attempt = 0; ; attempt += 1) {
    try {
      query = validateQuery(
        decodeQuery(candidate, parsed.messageId),
        context.source,
        parsed.question,
      );
      break;
    } catch (error) {
      if (attempt >= MAX_PLAN_REPAIRS)
        throw new ChatProviderError(
          "invalid_provider_output",
          error instanceof Error ? error.message : "Invalid query plan.",
        );
      try {
        candidate = decodeOutcome(
          await callProvider(
            provider,
            {
              kind: "repair",
              question: parsed.question,
              profile,
              invalidQuery: candidate,
              error: error instanceof Error ? error.message : "Invalid query",
            },
            signal,
            "query",
          ),
        );
      } catch (repairError) {
        if (repairError instanceof ChatProviderError) throw repairError;
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
  if (result.matchedRows === 0 && query.purpose === "lookup")
    return notInSource();
  const references = buildResultReferences(result, context.source, query);
  const finalAllowed = new Map(
    references.map((reference) => [reference.id, reference]),
  );
  let rawAnswer = await callProvider(
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
  for (let attempt = 0; ; attempt += 1) {
    try {
      const output = decodeOutcome(rawAnswer);
      if (output.outcome === "answer")
        return chatResultSchema.parse({
          outcome: "answered",
          answer: output.answer,
          references: validateAnswerReferences(
            output.answer,
            output.references,
            finalAllowed,
            Object.keys(result.metrics).length > 0 && result.groups.length === 0
              ? `query-${result.queryId}`
              : undefined,
            {
              kind: output.calculationKind,
              referenceIds: output.calculationReferenceIds,
              values: output.calculationValues,
              result: output.calculationResult,
              unit: output.calculationUnit,
            },
          ),
        });
      if (output.outcome === "clarification")
        return clarification(output.message);
      if (output.outcome === "unsupported_operation")
        return unsupported(output.message);
      if (output.outcome === "query")
        throw new Error("Query outcome is invalid for a final answer.");
      return notInSource();
    } catch (error) {
      if (attempt >= MAX_FINAL_REPAIRS)
        throw new ChatProviderError(
          "invalid_provider_output",
          error instanceof Error
            ? error.message
            : "Provider returned invalid query answer.",
        );
      rawAnswer = await callProvider(
        provider,
        {
          kind: "answer-repair",
          question: parsed.question,
          query,
          queryResult: {
            rows: result.rows.slice(0, 100),
            groups: result.groups.slice(0, 100),
            metrics: result.metrics,
            references,
          },
          invalidAnswer: rawAnswer,
          error: error instanceof Error ? error.message : "Invalid answer",
        },
        signal,
      );
    }
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
