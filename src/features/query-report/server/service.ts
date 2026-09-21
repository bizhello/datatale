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
import { validateArithmetic } from "./arithmetic";
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
  type QueryResultReference,
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

function formatAnswerValue(value: string | number | boolean | null) {
  if (value === null) return "нет значения";
  if (typeof value === "number")
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 2,
    }).format(value);
  return String(value);
}
function calculationInput(
  output: ProviderEnvelope,
  evidence: Map<string, QueryResultReference>,
) {
  const values = output.calculationEvidenceIds.map((id) => {
    const item = evidence.get(id)?.values?.find((value) => value.id === id);
    if (!item || typeof item.value !== "number")
      throw new Error("Calculation selected non-numeric evidence.");
    return item.value;
  });
  const first = values[0] as number;
  const second = values[1] as number;
  const units = output.calculationEvidenceIds.flatMap((id) => {
    const item = evidence.get(id)?.values?.find((value) => value.id === id);
    return item?.unit ? [item.unit] : [];
  });
  const result =
    output.calculationKind === "sum"
      ? values.reduce((sum, value) => sum + value, 0)
      : output.calculationKind === "difference"
        ? first - second
        : output.calculationKind === "ratio"
          ? first / second
          : output.calculationKind === "percentage_of"
            ? (first / second) * 100
            : ((second - first) / first) * 100;
  const unit =
    output.calculationKind === "sum" || output.calculationKind === "difference"
      ? (units[0] ?? "")
      : "";
  return {
    kind: output.calculationKind,
    referenceIds: output.calculationEvidenceIds,
    values,
    result,
    unit,
  } as const;
}
function renderTypedAnswer(
  output: ProviderEnvelope,
  evidence: Map<string, QueryResultReference>,
  source: Dataset | TextSource,
) {
  if (output.answerMode === "values") {
    const selected = output.answerEvidenceIds.map((id) => {
      const value = evidence.get(id)?.values?.find((item) => item.id === id);
      if (!value) throw new Error("Answer selected unknown typed evidence.");
      return value;
    });
    if (selected.length === 0) throw new Error("Value answer has no evidence.");
    const owners = new Map<string, typeof selected>();
    for (const value of selected) {
      const ownerValues = owners.get(value.referenceId) ?? [];
      ownerValues.push(value);
      owners.set(value.referenceId, ownerValues);
    }
    return [...owners]
      .map(([ownerId, ownerValues]) => {
        const owner = evidence.get(ownerId);
        const groupKey = owner?.values?.find(
          (item) => item.id === `${ownerId}:key`,
        );
        const parts = ownerValues
          .filter((value) => value.id !== groupKey?.id)
          .map(
            (value) =>
              `${value.label}: ${formatAnswerValue(value.value)}${value.unit ? ` ${value.unit}` : ""}`,
          );
        if (groupKey)
          parts.unshift(`Группа: ${formatAnswerValue(groupKey.value)}`);
        const block = parts.join("; ");
        return ownerId.startsWith("row-")
          ? `Строка источника: ${block}`
          : block;
      })
      .join("; ");
  }
  if (output.answerMode === "calculation") {
    if (output.calculationKind === "none")
      throw new Error("Calculation answer requires a calculation.");
    if (
      new Set(output.calculationEvidenceIds).size !==
      output.calculationEvidenceIds.length
    )
      throw new Error("Calculation operands must use distinct evidence IDs.");
    const input = calculationInput(output, evidence);
    const result = validateArithmetic(
      input,
      new Set(output.calculationEvidenceIds),
      evidence,
    );
    const unit =
      output.calculationKind === "percentage_of" ||
      output.calculationKind === "percentage_change"
        ? "%"
        : input.unit;
    return `${formatAnswerValue(result as number)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
  }
  if (output.answerEvidenceIds.length !== 1)
    throw new Error("Quote answer requires one source span.");
  if ("rows" in source)
    throw new Error("Quote answers are only available for text sources.");
  const spanId = output.answerEvidenceIds[0] as string;
  const span = buildTextEvidence(source).find((item) => item.id === spanId);
  if (
    !span ||
    output.answerSpanStart !== 0 ||
    output.answerSpanEnd !== span.text.length
  )
    throw new Error("Quote answer span is invalid.");
  if (output.answerSpanEnd > span.text.length)
    throw new Error("Quote answer span exceeds source bounds.");
  return span.text.slice(output.answerSpanStart, output.answerSpanEnd);
}
function proposalReferenceIds(output: ProviderEnvelope) {
  return output.answerMode === "calculation"
    ? output.calculationEvidenceIds
    : output.answerEvidenceIds;
}
function ownerReferences(
  ids: string[],
  evidence: Map<string, QueryResultReference>,
) {
  const seen = new Set<string>();
  return ids.flatMap((id) => {
    const reference = evidence.get(id);
    const owner =
      reference?.values?.find((value) => value.id === id)?.referenceId ?? id;
    if (!reference || seen.has(owner)) return [];
    seen.add(owner);
    return [
      { id: owner, excerpt: evidence.get(owner)?.excerpt ?? reference.excerpt },
    ];
  });
}

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
        if (output.outcome === "answer") {
          const answer = renderTypedAnswer(output, allowed, context.source);
          const references = proposalReferenceIds(output).map((id) => ({ id }));
          return chatResultSchema.parse({
            outcome: "answered",
            answer,
            references: ownerReferences(
              references.map((item) => item.id),
              allowed,
            ),
          });
        }
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
      if (output.outcome === "answer") {
        const answer = renderTypedAnswer(output, finalAllowed, context.source);
        const references = proposalReferenceIds(output).map((id) => ({ id }));
        return chatResultSchema.parse({
          outcome: "answered",
          answer,
          references: ownerReferences(
            references.map((item) => item.id),
            finalAllowed,
          ),
        });
      }
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
