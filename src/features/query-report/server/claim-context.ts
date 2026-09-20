import {
  CHAT_CONTEXT_MAX_SERIALIZED_BYTES,
  type ChatMessage,
} from "@/entities/chat";
import type { Dataset, TextSource } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { semanticTokenMatch } from "./label-match";

export type CanonicalClaim = {
  id: string;
  text: string;
  references: string[];
  kind: "fact" | "source" | FinalReport["hero"][number]["kind"];
};

type RetrievalCoverage = {
  kind: "table" | "text";
  matchedSources: number;
  includedSources: number;
  truncated: boolean;
  decisiveSourceId?: string;
};

export type ProviderContext = {
  claims: CanonicalClaim[];
  history: ChatMessage[];
  question: string;
  retrieval: RetrievalCoverage;
};

const stopwords = new Set([
  "about",
  "are",
  "does",
  "for",
  "from",
  "has",
  "have",
  "how",
  "tell",
  "the",
  "what",
  "when",
  "where",
  "which",
  "who",
  "был",
  "была",
  "были",
  "где",
  "для",
  "есть",
  "как",
  "какая",
  "какие",
  "какой",
  "когда",
  "мне",
  "про",
  "расскажи",
  "что",
  "это",
]);

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function normalized(value: string | number | boolean) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е");
}

function tokens(value: string) {
  return [
    ...new Set(
      normalized(value)
        .match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu)
        ?.filter((token) => token.length > 1 && !stopwords.has(token)) ?? [],
    ),
  ];
}

function valueScore(
  value: string | number | boolean,
  questionTokens: string[],
) {
  const text = normalized(value);
  const valueTokens = new Set(tokens(text));
  return questionTokens.reduce((score, token) => {
    if (text === token) return score + 8;
    if (valueTokens.has(token)) return score + 4;
    if (
      [...valueTokens].some((valueToken) =>
        semanticTokenMatch(valueToken, token),
      )
    )
      return score + 3;
    if (token.length >= 4 && text.includes(token)) return score + 1;
    return score;
  }, 0);
}

function rankedTableRows(
  source: Dataset,
  question: string,
  historyText: string,
) {
  const questionTokens = tokens(question);
  const historyTokens = tokens(historyText);
  if (questionTokens.length === 0 && historyTokens.length === 0) return [];
  const score = (row: Dataset["rows"][number], searchTokens: string[]) =>
    valueScore(row.provenance.sourceRowNumber, searchTokens) +
    Object.values(row.values).reduce<number>(
      (total, value) =>
        total + (value === null ? 0 : valueScore(value, searchTokens)),
      0,
    );
  return source.rows
    .map((row, index) => ({
      index,
      questionScore: score(row, questionTokens),
      historyScore: score(row, historyTokens),
    }))
    .filter(({ questionScore, historyScore }) => questionScore || historyScore)
    .sort(
      (left, right) =>
        right.questionScore - left.questionScore ||
        right.historyScore - left.historyScore ||
        left.index - right.index,
    );
}

function rowClaims(
  source: Dataset,
  rowIndex: number,
  retrievalText: string,
): CanonicalClaim[] {
  const row = source.rows[rowIndex];
  if (!row) return [];
  const retrievalTokens = tokens(retrievalText);
  return source.columns
    .map((column, columnIndex) => {
      const value = row.values[column.id] ?? null;
      return {
        claim: {
          id: `cell-${rowIndex}-${columnIndex}`,
          text: `${column.label}: ${formatCell(value, column.unit)}.`,
          references: [`row-${rowIndex}`],
          kind: "source" as const,
        },
        columnIndex,
        score:
          valueScore(column.label, retrievalTokens) +
          (value === null ? 0 : valueScore(value, retrievalTokens) * 2),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.columnIndex - right.columnIndex,
    )
    .map(({ claim }) => claim);
}

function rankedTextParagraphs(
  source: TextSource,
  question: string,
  historyText: string,
) {
  const questionTokens = tokens(question);
  const historyTokens = tokens(historyText);
  const score = (text: string, searchTokens: string[]) =>
    searchTokens.reduce((total, token) => total + valueScore(text, [token]), 0);
  return source.paragraphs
    .map((paragraph, index) => ({
      index,
      questionScore: score(paragraph.text, questionTokens),
      historyScore: score(paragraph.text, historyTokens),
    }))
    .sort(
      (left, right) =>
        right.questionScore - left.questionScore ||
        right.historyScore - left.historyScore ||
        left.index - right.index,
    );
}

function paragraphClaim(
  source: TextSource,
  index: number,
): CanonicalClaim | undefined {
  const paragraph = source.paragraphs[index];
  return paragraph
    ? {
        id: `paragraph-${index}`,
        text: paragraph.text,
        references: [`paragraph-${index}`],
        kind: "source",
      }
    : undefined;
}

function reportClaims(report: FinalReport): CanonicalClaim[] {
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
  return claims;
}

function decisiveSourceId(
  ranked: Array<{ index: number; questionScore: number; historyScore: number }>,
  prefix: "row" | "paragraph",
) {
  const [first, second] = ranked;
  if (!first) return undefined;
  if (
    second &&
    first.questionScore === second.questionScore &&
    first.historyScore === second.historyScore
  )
    return undefined;
  return `${prefix}-${first.index}`;
}

function isPointLookup(question: string) {
  const value = normalized(question);
  if (
    /\b(?:all|average|avg|compare|count|every|list|rank|remaining|others|sum|top|total)\b|все|всех|кажд|остальн|перечисл|список|сколько|количеств|сумм|итог|средн|сравн|рейтинг|топ/iu.test(
      value,
    )
  )
    return false;
  return /\b(?:which|who|where|when|what|about|for)\b|какой|какая|какое|кто|где|когда|что\s+.{0,40}\sпро|(?:расскажи|покажи)\s+.{0,20}\sпро|у\s+(?:него|нее|них)/iu.test(
    value,
  );
}

export function buildProviderContext(input: {
  source: Dataset | TextSource;
  report: FinalReport;
  history: ChatMessage[];
  question: string;
}): ProviderContext {
  const claims = reportClaims(input.report);
  const historyText = input.history
    .slice(-4)
    .map((message) => message.content)
    .join("\n");
  const retrievalText = `${input.question}\n${historyText}`;
  const ranked =
    "rows" in input.source
      ? rankedTableRows(input.source, input.question, historyText)
      : rankedTextParagraphs(input.source, input.question, historyText);
  const decisive = isPointLookup(input.question)
    ? decisiveSourceId(ranked, "rows" in input.source ? "row" : "paragraph")
    : undefined;
  const retrieval: RetrievalCoverage = {
    kind: "rows" in input.source ? "table" : "text",
    matchedSources: ranked.length,
    includedSources: 0,
    truncated: false,
    ...(decisive ? { decisiveSourceId: decisive } : {}),
  };
  const context: ProviderContext = {
    claims,
    history: input.history,
    question: input.question,
    retrieval,
  };
  let contextBytes = serializedBytes(context);
  const bookkeepingReserve = 64;

  for (const candidate of ranked) {
    const next =
      "rows" in input.source
        ? rowClaims(input.source, candidate.index, retrievalText)
        : [paragraphClaim(input.source, candidate.index)].filter(
            (claim): claim is CanonicalClaim => claim !== undefined,
          );
    let included = false;
    for (const claim of next) {
      const claimBytes = serializedBytes(claim) + 1;
      if (
        contextBytes + claimBytes + bookkeepingReserve >
        CHAT_CONTEXT_MAX_SERIALIZED_BYTES
      ) {
        context.retrieval.truncated = true;
        continue;
      }
      context.claims.push(claim);
      contextBytes += claimBytes;
      included = true;
    }
    if (included) context.retrieval.includedSources += 1;
  }
  context.retrieval.truncated ||=
    context.retrieval.includedSources < context.retrieval.matchedSources;
  return context;
}

export function numberText(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(
    value,
  );
}

function formatCell(value: string | number | boolean | null, unit?: string) {
  if (value === null) return "нет значения";
  if (typeof value === "number")
    return `${numberText(value)}${unit ? ` ${unit}` : ""}`;
  return String(value);
}

export function reportReferenceId(report: FinalReport, id: string) {
  const index = report.evidence.findIndex((item) => item.id === id);
  return index >= 0 ? `evidence-${index}` : undefined;
}

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
