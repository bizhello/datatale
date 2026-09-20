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
import type { Dataset, TextSource } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";
import { compensatedSum } from "@/shared/lib/compensated-sum";
import { chartExtremum } from "./chart-extremum";
import {
  buildProviderContext,
  type CanonicalClaim,
  numberText,
  reportReferenceId,
} from "./claim-context";
import {
  labelFollowsMarkerInQuestion,
  labelMentionedInQuestion,
} from "./label-match";
import { checkedReportSummary } from "./report-summary";

export const CHAT_TIMEOUT_MS = 30_000;
const PROVIDER_OUTPUT_MAX_TOKENS = 700;
const providerResponseSchema = z
  .object({
    outcome: z.enum(["answered", "insufficient_data", "unsupported_operation"]),
    claimIds: z.array(z.string().min(1).max(160)).max(6),
  })
  .strict();

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

function insufficient(): ChatResult {
  return { outcome: "insufficient_data", message: CHAT_REFUSAL };
}

function unsupported(
  message = "Эта операция не поддерживается для данного отчета.",
): ChatResult {
  return { outcome: "unsupported_operation", message };
}

function boundedHistory(history: ChatMessage[]) {
  return history.slice(-CHAT_HISTORY_MAX_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, CHAT_HISTORY_MESSAGE_MAX_LENGTH),
  }));
}

function sourceEvidence(report: FinalReport, id: string) {
  return report.evidence.find((item) => item.id === id);
}

type SourceReference = {
  id: string;
  values: Array<string | number | boolean>;
  excerpt?: string;
  factIds: string[];
};

function sourceReferences(
  source: Dataset | TextSource,
  report: FinalReport,
): SourceReference[] {
  const references: SourceReference[] = report.evidence.map(
    (evidence, index) => ({
      id: `evidence-${index}`,
      values: [
        ...(evidence.excerpt ? [evidence.excerpt] : []),
        ...report.metrics
          .filter((fact) => fact.evidenceIds.includes(evidence.id))
          .map((fact) => fact.value),
      ],
      ...(evidence.excerpt ? { excerpt: evidence.excerpt } : {}),
      factIds: report.metrics
        .filter((fact) => fact.evidenceIds.includes(evidence.id))
        .map((fact) => fact.id),
    }),
  );
  if ("rows" in source) {
    for (const [index, row] of source.rows.entries()) {
      references.push({
        id: `row-${index}`,
        values: Object.values(row.values).filter(
          (value): value is string | number | boolean => value !== null,
        ),
        factIds: [],
      });
    }
  } else {
    for (const [index, paragraph] of source.paragraphs.entries())
      references.push({
        id: `paragraph-${index}`,
        values: [paragraph.text],
        excerpt: paragraph.text,
        factIds: [],
      });
  }
  return references;
}

function deterministicFact(
  question: string,
  report: FinalReport,
): ChatResult | undefined {
  const normalized = question.toLocaleLowerCase("ru-RU");
  const fact = report.metrics.find((candidate) =>
    normalized.includes(candidate.label.toLocaleLowerCase("ru-RU")),
  );
  if (!fact) return undefined;
  const evidence = fact.evidenceIds
    .map((id) => sourceEvidence(report, id))
    .find(Boolean);
  if (!evidence) return undefined;
  const unit = fact.unit ? ` ${fact.unit}` : "";
  return {
    outcome: "answered",
    answer: `${fact.label}: ${numberText(fact.value)}${unit}.`,
    references: [
      {
        id: reportReferenceId(report, evidence.id) ?? evidence.id,
        ...(evidence.excerpt ? { excerpt: evidence.excerpt } : {}),
      },
    ],
  };
}

type Aggregation = "count" | "sum" | "average" | "min" | "max";

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stringValueMentioned(question: string, value: string) {
  const normalized = value.trim().toLocaleLowerCase("ru-RU");
  if (normalized.length < 2 || normalized.length > 80) return false;
  return (
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escapedPattern(normalized)}(?:$|[^\\p{L}\\p{N}])`,
      "u",
    ).test(question) || labelMentionedInQuestion(normalized, question)
  );
}

function numberValueMentioned(question: string, value: number) {
  const compactQuestion = question.replace(/[\s\u00a0\u202f]/gu, "");
  const compactValue = numberText(value).replace(/[\s\u00a0\u202f]/gu, "");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapedPattern(compactValue)}(?:$|[^\\p{L}\\p{N}])`,
    "u",
  ).test(compactQuestion);
}

function filteredRows(
  question: string,
  source: Dataset,
  measureColumnId: string | undefined,
) {
  const normalizedQuestion = question.toLocaleLowerCase("ru-RU");
  const aggregationVocabulary = new Set([
    "average",
    "avg",
    "count",
    "sum",
    "total",
    "всего",
    "итог",
    "итого",
    "количество",
    "среднее",
    "сумма",
  ]);
  const filters = source.columns.flatMap((column) => {
    const matched = new Map<string, string | number | boolean>();
    for (const row of source.rows) {
      const value = row.values[column.id];
      if (value === null || value === undefined) continue;
      if (
        typeof value === "string" &&
        aggregationVocabulary.has(value.trim().toLocaleLowerCase("ru-RU"))
      )
        continue;
      const mentioned =
        typeof value === "number"
          ? numberValueMentioned(normalizedQuestion, value)
          : stringValueMentioned(normalizedQuestion, String(value));
      if (mentioned) matched.set(`${typeof value}:${String(value)}`, value);
    }
    return matched.size === 0 ? [] : [{ columnId: column.id, values: matched }];
  });
  if (filters.some((filter) => filter.values.size > 1)) return undefined;
  if (filters.some((filter) => filter.columnId === measureColumnId))
    return undefined;
  const withoutGenericScope = normalizedQuestion
    .replace(/\b(?:in|for)\s+(?:the\s+)?(?:report|table|dataset|data)\b/gu, "")
    .replace(
      /(?<!\p{L})(?:в|во|по)\s+(?:этом\s+)?(?:отч[её]те|таблице|данных|всем\s+строкам|всем\s+данным)(?!\p{L})/gu,
      "",
    );
  const constraintMarkers = [
    ...(withoutGenericScope.match(
      /\b(?:in|for|from|at|where|when|during|before|after)\b/gu,
    ) ?? []),
    ...(withoutGenericScope.match(
      /(?<!\p{L})(?:в|во|на|для|по|у|из|за|при|где|когда|до|после)(?!\p{L})/gu,
    ) ?? []),
  ];
  const equalityMarkers = [
    ...(withoutGenericScope.match(/\b(?:in|for|at|where)\b/gu) ?? []),
    ...(withoutGenericScope.match(
      /(?<!\p{L})(?:в|во|на|для|по|у|при)(?!\p{L})/gu,
    ) ?? []),
  ];
  const soleFilter = filters.length === 1 ? filters[0] : undefined;
  const soleFilterValue = soleFilter
    ? [...soleFilter.values.values()][0]
    : undefined;
  const hasDirectEqualityFilter =
    soleFilterValue !== undefined &&
    labelFollowsMarkerInQuestion(
      String(soleFilterValue),
      withoutGenericScope,
      new Set([
        "in",
        "for",
        "at",
        "where",
        "в",
        "во",
        "на",
        "для",
        "по",
        "у",
        "при",
      ]),
    );
  const hasNumericOrRangeConstraint =
    /\d/u.test(withoutGenericScope) ||
    /(?:[<>]=?|!=|≥|≤)|\b(?:above|below|between|over|under|greater|less)\b|больше|меньше|между|выше|ниже/u.test(
      withoutGenericScope,
    );
  const hasNegativeConstraint =
    /\b(?:not|except\w*|exclud\w*|without|outside)\b|(?<!\p{L})(?:не|кроме|без|исключ\p{L}*)(?!\p{L})/u.test(
      withoutGenericScope,
    );
  const hasRelationalConstraint =
    /\b(?:before|after|from|since|until|through|starting)\b|(?<!\p{L})(?:до|после|из|с|к|начиная|включительно)(?!\p{L})/u.test(
      withoutGenericScope,
    );
  if (
    hasNumericOrRangeConstraint ||
    hasNegativeConstraint ||
    hasRelationalConstraint ||
    filters.length > 1 ||
    constraintMarkers.length > filters.length ||
    (filters.length === 1 &&
      (equalityMarkers.length !== 1 || !hasDirectEqualityFilter))
  )
    return undefined;
  if (filters.length === 0) return { rows: source.rows, filtered: false };
  return {
    rows: source.rows.filter((row) =>
      filters.every((filter) => {
        const value = row.values[filter.columnId];
        return (
          value !== null &&
          filter.values.has(`${typeof value}:${String(value)}`)
        );
      }),
    ),
    filtered: true,
  };
}

function requestedAggregation(
  question: string,
): Aggregation | "unsupported" | undefined {
  const lower = question.toLocaleLowerCase("ru-RU");
  if (
    /\bmedian\b|медиан|процент|дол[яи]|корреляц|регресс|тренд|рост|изменен/u.test(
      lower,
    )
  )
    return "unsupported";
  if (
    /\b(?:count|how\s+many)\b|(?<!\p{L})числ(?:о|а|у|ом|е)?(?!\p{L})|сколько|количеств/u.test(
      lower,
    )
  )
    return "count";
  if (/(?:\b(sum|total)\b|сумм|итог|всего)/u.test(lower)) return "sum";
  if (/(?:\b(average|avg)\b|средн)/u.test(lower)) return "average";
  if (/(?:\b(min)\b|миним|наименьш)/u.test(lower)) return "min";
  if (/(?:\b(max)\b|максим|наибольш)/u.test(lower)) return "max";
  return undefined;
}

function deterministicAggregation(
  question: string,
  source: Dataset,
  report: FinalReport,
): ChatResult | undefined {
  const aggregation = requestedAggregation(question);
  if (!aggregation) return undefined;
  if (aggregation === "unsupported") return unsupported();
  const lowerQuestion = question.toLocaleLowerCase("ru-RU");
  const columns = source.columns.filter((candidate) =>
    labelMentionedInQuestion(candidate.label, lowerQuestion),
  );
  if (aggregation === "count" && columns.length > 1) return insufficient();
  const column = columns.length === 1 ? columns[0] : undefined;
  if (
    aggregation === "count" &&
    columns.length === 0 &&
    !/\b(?:row|record|rows|records)\b|строк|запис/u.test(lowerQuestion)
  )
    return insufficient();
  if (aggregation !== "count" && column?.scalarType !== "number")
    return insufficient();
  const selection = filteredRows(question, source, column?.id);
  if (!selection) return undefined;
  const selectedRows = selection.rows;
  const values = column
    ? selectedRows
        .map((row) => row.values[column.id])
        .filter((value): value is number => typeof value === "number")
    : [];
  if (aggregation !== "count" && values.length === 0) return insufficient();
  const value =
    aggregation === "count"
      ? column
        ? selectedRows.filter((row) => row.values[column.id] !== null).length
        : selectedRows.length
      : aggregation === "sum"
        ? compensatedSum(values)
        : aggregation === "average"
          ? compensatedSum(values) / values.length
          : aggregation === "min"
            ? Math.min(...values)
            : Math.max(...values);
  const label = column?.label ?? "Строки";
  const references = selection.filtered
    ? selectedRows.slice(0, 7).map((row) => {
        const sourceIndex = source.rows.indexOf(row);
        return { id: `row-${sourceIndex}` };
      })
    : (() => {
        const evidence = sourceEvidence(report, "rows-all");
        return evidence
          ? [{ id: reportReferenceId(report, evidence.id) ?? evidence.id }]
          : [];
      })();
  if (references.length === 0) return insufficient();
  return {
    outcome: "answered",
    answer: `${label}: ${numberText(value)}${column?.unit ? ` ${column.unit}` : ""}.`,
    references,
  };
}

function validateProviderResult(
  output: unknown,
  claims: CanonicalClaim[],
  references: SourceReference[],
  retrieval: ReturnType<typeof buildProviderContext>["retrieval"],
): ChatResult {
  const value = providerResponseSchema.parse(output);
  if (value.outcome === "insufficient_data") return insufficient();
  if (value.outcome === "unsupported_operation") return unsupported();
  if (value.claimIds.length === 0)
    throw new Error("Provider selected no claims.");
  const selected: CanonicalClaim[] = [];
  const seen = new Set<string>();
  for (const id of value.claimIds) {
    if (seen.has(id)) throw new Error("Provider selected a duplicate claim.");
    seen.add(id);
    const claim = claims.find((candidate) => candidate.id === id);
    if (!claim) throw new Error("Provider selected an unknown claim.");
    selected.push(claim);
  }
  if (
    retrieval.truncated &&
    selected.some(
      (claim) =>
        claim.kind === "source" &&
        (!retrieval.decisiveSourceId ||
          claim.references.some(
            (reference) => reference !== retrieval.decisiveSourceId,
          )),
    )
  )
    return unsupported();
  const answer = selected.map((claim) => claim.text).join(" ");
  if (answer.length > CHAT_ANSWER_MAX_LENGTH)
    throw new Error("Selected claims are too long.");
  const resultReferences = [
    ...new Set(selected.flatMap((claim) => claim.references)),
  ].map((id) => {
    const reference = references.find((candidate) => candidate.id === id);
    if (!reference)
      throw new Error("Claim referenced unknown canonical evidence.");
    return {
      id: reference.id,
      ...(reference.excerpt ? { excerpt: reference.excerpt } : {}),
    };
  });
  return chatResultSchema.parse({
    outcome: "answered",
    answer,
    references: resultReferences.slice(0, 7),
  });
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
    output: Output.object({ schema: providerResponseSchema }),
    prompt: `${promptFile}\n\n${prompt}`,
    maxRetries: 0,
    maxOutputTokens: PROVIDER_OUTPUT_MAX_TOKENS,
    abortSignal: signal,
    timeout: CHAT_TIMEOUT_MS,
  });
  return response.output;
}

async function answerChatCore(
  request: ChatRequest,
  dependencies: ChatDependencies,
): Promise<ChatResult> {
  const signal = dependencies.signal ?? new AbortController().signal;
  const ensureActive = () => {
    if (signal.aborted)
      throw new ChatProviderError(
        "provider_aborted",
        "Chat request was cancelled.",
      );
  };
  const parsed = chatRequestSchema.parse(request);
  let context: ChatContext | undefined;
  try {
    context = await dependencies.loadContext(parsed.analysisId, signal);
  } catch (error) {
    if (signal.aborted)
      throw new ChatProviderError(
        "provider_aborted",
        "Chat request was cancelled.",
      );
    throw new ChatProviderError(
      "provider_failure",
      error instanceof Error ? error.message : "Context loading failed.",
    );
  }
  ensureActive();
  if (!context || context.analysisId !== parsed.analysisId)
    return insufficient();
  const history = boundedHistory(context.history);
  const summary = checkedReportSummary(parsed.question, context.report);
  if (summary) {
    ensureActive();
    return summary;
  }
  const requested = requestedAggregation(parsed.question);
  if (requested === "unsupported") {
    ensureActive();
    return unsupported();
  }
  const extremum = chartExtremum(parsed.question, context.report);
  if (extremum && extremum !== "incomplete") {
    const evidence = sourceEvidence(context.report, extremum.evidenceId);
    if (evidence) {
      ensureActive();
      return {
        outcome: "answered",
        answer: extremum.answer,
        references: [
          {
            id: reportReferenceId(context.report, evidence.id) ?? evidence.id,
            ...(evidence.excerpt ? { excerpt: evidence.excerpt } : {}),
          },
        ],
      };
    }
  }
  if (extremum !== "incomplete" && "rows" in context.source) {
    const aggregate = deterministicAggregation(
      parsed.question,
      context.source,
      context.report,
    );
    if (aggregate) {
      ensureActive();
      return aggregate;
    }
  }
  const direct = deterministicFact(parsed.question, context.report);
  if (
    direct &&
    !requested &&
    !/\b(?:which|where|when|region|row|paragraph)\b|какой|какая|где|когда|строк|абзац/u.test(
      parsed.question.toLocaleLowerCase("ru-RU"),
    )
  ) {
    ensureActive();
    return direct;
  }
  const sourceContext = buildProviderContext({
    source: context.source,
    report: context.report,
    history,
    question: parsed.question,
  });
  const { claims } = sourceContext;
  ensureActive();
  try {
    const provider = dependencies.provider ?? defaultProvider;
    const output = await provider({
      prompt: JSON.stringify(sourceContext),
      signal,
    });
    try {
      return validateProviderResult(
        output,
        claims,
        sourceReferences(context.source, context.report),
        sourceContext.retrieval,
      );
    } catch (error) {
      if (error instanceof ChatProviderError) throw error;
      throw new ChatProviderError(
        "invalid_provider_output",
        error instanceof Error
          ? error.message
          : "Chat provider returned invalid output.",
      );
    }
  } catch (error) {
    if (error instanceof ChatProviderError) throw error;
    if (signal.aborted)
      throw new ChatProviderError(
        "provider_aborted",
        "Chat request was cancelled.",
      );
    if (error instanceof z.ZodError)
      throw new ChatProviderError(
        "invalid_provider_output",
        "Chat provider returned invalid output.",
      );
    throw new ChatProviderError(
      "provider_failure",
      error instanceof Error ? error.message : "Chat provider failed.",
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
  const abortExternal = () => controller.abort();
  const externalSignal = dependencies.signal;
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener("abort", abortExternal, { once: true });
  try {
    if (controller.signal.aborted)
      throw new ChatProviderError(
        externalSignal?.aborted ? "provider_aborted" : "provider_timeout",
        "Chat request was cancelled.",
      );
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
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortExternal);
  }
}
