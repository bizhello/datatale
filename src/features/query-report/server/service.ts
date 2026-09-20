import "server-only";

import { readFile } from "node:fs/promises";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  CHAT_ANSWER_MAX_LENGTH,
  CHAT_CONTEXT_MAX_SERIALIZED_BYTES,
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
import { chartExtremum } from "./chart-extremum";

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

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
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

function reportReferenceId(report: FinalReport, id: string) {
  const index = report.evidence.findIndex((item) => item.id === id);
  return index >= 0 ? `evidence-${index}` : undefined;
}

type SourceReference = {
  id: string;
  values: Array<string | number | boolean>;
  excerpt?: string;
  factIds: string[];
};

type CanonicalClaim = {
  id: string;
  text: string;
  references: string[];
  kind: "fact" | "source" | FinalReport["hero"][number]["kind"];
};

function narrativeReferenceIds(
  item: FinalReport["hero"][number],
  report: FinalReport,
) {
  const evidenceIds = [
    ...item.evidenceIds,
    ...item.factIds.flatMap(
      (factId) =>
        report.metrics.find((fact) => fact.id === factId)?.evidenceIds ?? [],
    ),
  ];
  return [
    ...new Set(
      evidenceIds.flatMap((id) => {
        const referenceId = reportReferenceId(report, id);
        return referenceId ? [referenceId] : [];
      }),
    ),
  ];
}

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
    for (const row of source.rows) {
      references.push({
        id: `row-${source.rows.indexOf(row)}`,
        values: Object.values(row.values).filter(
          (value): value is string | number | boolean => value !== null,
        ),
        factIds: [],
      });
    }
  } else {
    for (const paragraph of source.paragraphs)
      references.push({
        id: `paragraph-${source.paragraphs.indexOf(paragraph)}`,
        values: [paragraph.text],
        excerpt: paragraph.text,
        factIds: [],
      });
  }
  return references;
}

function formatCell(value: string | number | boolean | null, unit?: string) {
  if (value === null) return "нет значения";
  if (typeof value === "number")
    return `${numberText(value)}${unit ? ` ${unit}` : ""}`;
  return String(value);
}

function canonicalClaims(
  source: Dataset | TextSource,
  report: FinalReport,
): CanonicalClaim[] {
  const claims: CanonicalClaim[] = [];
  for (const [index, fact] of report.metrics.entries()) {
    const evidenceId = reportReferenceId(report, fact.evidenceIds[0] ?? "");
    if (evidenceId)
      claims.push({
        id: `fact-${index}`,
        text: `${fact.label}: ${formatCell(fact.value, fact.unit)}.`,
        references: [evidenceId],
        kind: "fact",
      });
  }
  for (const [index, item] of report.hero.entries()) {
    const references = narrativeReferenceIds(item, report);
    if (references.length > 0)
      claims.push({
        id: `hero-${index}`,
        text: item.text,
        references,
        kind: item.kind,
      });
  }
  if ("rows" in source) {
    for (const [rowIndex, row] of source.rows.entries()) {
      const referenceId = `row-${rowIndex}`;
      for (const [columnIndex, column] of source.columns.entries()) {
        claims.push({
          id: `cell-${rowIndex}-${columnIndex}`,
          text: `${column.label}: ${formatCell(row.values[column.id] ?? null, column.unit)}.`,
          references: [referenceId],
          kind: "source",
        });
      }
    }
  } else {
    for (const [index, paragraph] of source.paragraphs.entries())
      claims.push({
        id: `paragraph-${index}`,
        text: paragraph.text,
        references: [`paragraph-${index}`],
        kind: "source",
      });
  }
  return claims;
}

function numberText(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(
    value,
  );
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
function requestedAggregation(
  question: string,
): Aggregation | "unsupported" | undefined {
  const lower = question.toLocaleLowerCase("ru-RU");
  if (
    /\b(median|медиан|процент|дол[яи]|корреляц|регресс|тренд|рост|изменен)/u.test(
      lower,
    )
  )
    return "unsupported";
  if (/(?:\b(count)\b|числ|сколько|количеств)/u.test(lower)) return "count";
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
  const columns = source.columns.filter((candidate) => {
    const label = candidate.label
      .toLocaleLowerCase("ru-RU")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(^|[^\\p{L}\\p{N}_])${label}($|[^\\p{L}\\p{N}_])`,
      "u",
    ).test(lowerQuestion);
  });
  if (aggregation === "count" && columns.length > 1) return insufficient();
  const column = columns.length === 1 ? columns[0] : undefined;
  if (
    aggregation === "count" &&
    columns.length === 0 &&
    !/\b(row|record|rows|records|строк|запис)/u.test(lowerQuestion)
  )
    return insufficient();
  if (aggregation !== "count" && column?.scalarType !== "number")
    return insufficient();
  const values = column
    ? source.rows
        .map((row) => row.values[column.id])
        .filter((value): value is number => typeof value === "number")
    : [];
  if (aggregation !== "count" && values.length === 0) return insufficient();
  const value =
    aggregation === "count"
      ? column
        ? source.rows.filter((row) => row.values[column.id] !== null).length
        : source.rows.length
      : aggregation === "sum"
        ? values.reduce((total, current) => total + current, 0)
        : aggregation === "average"
          ? values.reduce((total, current) => total + current, 0) /
            values.length
          : aggregation === "min"
            ? Math.min(...values)
            : Math.max(...values);
  const evidence = sourceEvidence(report, "rows-all");
  if (!evidence) return insufficient();
  const label = column?.label ?? "Строки";
  return {
    outcome: "answered",
    answer: `${label}: ${numberText(value)}${column?.unit ? ` ${column.unit}` : ""}.`,
    references: [{ id: reportReferenceId(report, evidence.id) ?? evidence.id }],
  };
}

function validateProviderResult(
  output: unknown,
  claims: CanonicalClaim[],
  references: SourceReference[],
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
    !/\b(which|where|when|region|row|paragraph|какой|какая|где|когда|строк|абзац)/u.test(
      parsed.question.toLocaleLowerCase("ru-RU"),
    )
  ) {
    ensureActive();
    return direct;
  }
  const claims = canonicalClaims(context.source, context.report);
  const sourceContext = { claims, history, question: parsed.question };
  if (bytes(sourceContext) > CHAT_CONTEXT_MAX_SERIALIZED_BYTES)
    return unsupported("Контекст отчета слишком велик для безопасного ответа.");
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
