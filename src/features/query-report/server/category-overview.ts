import {
  CHAT_ANSWER_MAX_LENGTH,
  type ChatResult,
  chatResultSchema,
} from "@/entities/chat";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { numberText, reportReferenceId } from "./claim-context";
import { labelMentionedInQuestion, semanticTokenMatch } from "./label-match";

function normalized(value: string | number | boolean) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е");
}

function requestsOverview(question: string) {
  const value = normalized(question);
  return /информац|сведен|расскажи|покажи|что\s+известно|\b(?:information|tell|show)\b/u.test(
    value,
  );
}

const lowInformationValues = new Set([
  "a",
  "an",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "в",
  "во",
  "для",
  "из",
  "на",
  "о",
  "об",
  "по",
  "про",
  "с",
  "у",
]);

const simpleOverviewWords = new Set([
  "about",
  "give",
  "information",
  "is",
  "known",
  "me",
  "on",
  "show",
  "tell",
  "the",
  "what",
  "дай",
  "дайте",
  "известно",
  "информацию",
  "информация",
  "мне",
  "о",
  "об",
  "покажи",
  "покажите",
  "по",
  "про",
  "расскажи",
  "расскажите",
  "сведения",
  "что",
]);

function words(value: string | boolean) {
  return normalized(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function questionOnlyRequestsCategoryOverview(
  question: string,
  categoryValue: string | boolean,
) {
  const categoryWords = words(categoryValue);
  return words(question).every(
    (questionWord) =>
      simpleOverviewWords.has(questionWord) ||
      categoryWords.some((categoryWord) =>
        semanticTokenMatch(categoryWord, questionWord),
      ),
  );
}

function isInformativeCategoryValue(value: string | boolean) {
  const tokens = words(value);
  return (
    normalized(value).length <= 120 &&
    tokens.some(
      (token) => token.length >= 3 && !lowInformationValues.has(token),
    )
  );
}

function rowCountText(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? `${count} строке` : `${count} строках`;
}

export function categoryOverview(
  question: string,
  source: Dataset,
  report: FinalReport,
): ChatResult | undefined {
  if (!requestsOverview(question)) return undefined;
  const candidates = new Map<
    string,
    {
      column: Dataset["columns"][number];
      value: string | boolean;
      rowIndexes: number[];
    }
  >();
  for (const column of source.columns) {
    if (column.scalarType !== "string" && column.scalarType !== "boolean")
      continue;
    for (const [rowIndex, row] of source.rows.entries()) {
      const value = row.values[column.id];
      if (
        (typeof value !== "string" && typeof value !== "boolean") ||
        !isInformativeCategoryValue(value) ||
        !labelMentionedInQuestion(String(value), question)
      )
        continue;
      const key = `${column.id}:${typeof value}:${normalized(value)}`;
      const existing = candidates.get(key);
      if (existing) existing.rowIndexes.push(rowIndex);
      else candidates.set(key, { column, value, rowIndexes: [rowIndex] });
    }
  }
  if (candidates.size !== 1) return undefined;
  const [candidate] = candidates.values();
  if (!candidate) return undefined;
  if (!questionOnlyRequestsCategoryOverview(question, candidate.value))
    return undefined;

  const chartDetails = report.charts.flatMap((chart) => {
    if (chart.aggregation.dimensionFieldId !== candidate.column.id) return [];
    const point = chart.points.find(
      (item) => normalized(item.label) === normalized(candidate.value),
    );
    return point
      ? [
          `${chart.title}: ${numberText(point.value)}${chart.unit ? ` ${chart.unit}` : ""}.`,
        ]
      : [];
  });
  const completeTableEvidence = report.evidence.find(
    (item) =>
      item.kind === "row-range" &&
      item.coverage?.included === source.rows.length &&
      item.coverage.total === source.rows.length,
  );
  const evidenceId = completeTableEvidence
    ? reportReferenceId(report, completeTableEvidence.id)
    : undefined;
  const references = evidenceId
    ? [{ id: evidenceId }]
    : candidate.rowIndexes.slice(0, 7).map((rowIndex) => ({
        id: `row-${rowIndex}`,
      }));
  if (references.length === 0) return undefined;
  const overview = `В поле «${candidate.column.label}» значение «${String(candidate.value)}» встречается в ${rowCountText(candidate.rowIndexes.length)}.`;
  if (overview.length > CHAT_ANSWER_MAX_LENGTH) return undefined;
  const sentences = [overview];
  for (const detail of chartDetails) {
    if ([...sentences, detail].join(" ").length > CHAT_ANSWER_MAX_LENGTH) break;
    sentences.push(detail);
  }
  return chatResultSchema.parse({
    outcome: "answered",
    answer: sentences.join(" "),
    references,
  });
}
