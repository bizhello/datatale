import type { ChatMessage } from "@/entities/chat";
import {
  CHAT_HISTORY_MAX_MESSAGES,
  CHAT_HISTORY_MESSAGE_MAX_LENGTH,
} from "@/entities/chat";
import type {
  Dataset,
  DatasetQuery,
  DatasetQueryResult,
  TextSource,
} from "@/entities/dataset";
import type { NumericEvidence } from "./arithmetic";

export const CHAT_EVIDENCE_MAX_LENGTH = 1_000;
const MAX_DISTINCT_VALUES = 40;

export type QueryResultReference = {
  id: string;
  excerpt?: string;
  numericValues?: number[];
  numericEvidence?: NumericEvidence[];
};

export function boundedHistory(history: ChatMessage[]) {
  return history.slice(-CHAT_HISTORY_MAX_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, CHAT_HISTORY_MESSAGE_MAX_LENGTH),
  }));
}

function rowExcerpt(row: { values: Record<string, unknown> }) {
  return boundedEvidence(
    Object.entries(row.values)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; "),
  );
}
function boundedEvidence(value: string) {
  return value.slice(0, CHAT_EVIDENCE_MAX_LENGTH);
}
const numericToken =
  /(?<![\p{L}\d])[+\-−]?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)(?![\p{L}\d])/gu;
export function numericValues(value: string) {
  return (
    value
      .match(numericToken)
      ?.map((token) => Number(token.replace(",", ".").replace("−", "-"))) ?? []
  );
}

export function textEvidence(source: TextSource) {
  return source.paragraphs.flatMap((paragraph) => {
    const chunks: Array<{ id: string; text: string }> = [];
    for (let offset = 0; offset < paragraph.text.length; ) {
      let end = Math.min(
        offset + CHAT_EVIDENCE_MAX_LENGTH,
        paragraph.text.length,
      );
      let hardBoundary = false;
      if (end < paragraph.text.length) {
        const boundary = paragraph.text.lastIndexOf(" ", end);
        if (boundary > offset + 100) end = boundary;
        else hardBoundary = true;
      }
      const chunk = paragraph.text.slice(offset, end);
      const suffix =
        paragraph.text.length <= CHAT_EVIDENCE_MAX_LENGTH
          ? ""
          : `-${chunks.length + 1}`;
      chunks.push({ id: `paragraph-${paragraph.index}${suffix}`, text: chunk });
      offset = hardBoundary ? Math.max(offset + 1, end - 64) : end;
      while (paragraph.text[offset] === " ") offset += 1;
    }
    return chunks;
  });
}

export function sourceReferences(
  source: Dataset | TextSource,
): QueryResultReference[] {
  return "rows" in source
    ? source.rows.map((row) => {
        const excerpt = rowExcerpt(row);
        const numericEvidence = source.columns.flatMap((column) => {
          const value = row.values[column.id];
          return typeof value === "number"
            ? [{ value, ...(column.unit ? { unit: column.unit } : {}) }]
            : [];
        });
        return {
          id: `row-${row.id}`,
          excerpt,
          numericValues: numericEvidence.map((item) => item.value),
          numericEvidence,
        };
      })
    : textEvidence(source).map((paragraph) => {
        const values = numericValues(paragraph.text);
        return {
          id: paragraph.id,
          excerpt: paragraph.text,
          numericValues: values,
          numericEvidence: values.map((value) => ({ value })),
        };
      });
}

const russianWordEndings =
  /(ами|ями|ого|ему|ому|ее|ие|ые|ой|ий|ый|ая|яя|ое|ее|ие|ые|ам|ям|ом|ем|ым|им|ах|ях|ов|ев|ей|ью|ою|ею|ов|ев|ью|ю|я|а|ы|и|е|о|у|э|ь|й)$/u;
function normalizedWords(value: string) {
  return (
    value
      .toLocaleLowerCase("ru-RU")
      .replaceAll("ё", "е")
      .match(/[\p{L}\p{N}]+/gu)
      ?.map((word) => word.replace(russianWordEndings, ""))
      .filter((word) => word.length >= 3) ?? []
  );
}
function valueMentionedInQuestion(value: string, question: string) {
  const normalizedValue = value.toLocaleLowerCase("ru-RU");
  const normalizedQuestion = question.toLocaleLowerCase("ru-RU");
  if (
    normalizedQuestion.includes(normalizedValue) ||
    normalizedValue.includes(normalizedQuestion)
  )
    return true;
  const questionWords = new Set(normalizedWords(question));
  return normalizedWords(value).some((word) => questionWords.has(word));
}
export function columns(
  source: Dataset,
  question: string,
  history: ChatMessage[],
) {
  const candidateText = [
    question,
    ...history.map((message) => message.content),
  ].join(" ");
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
        valueMentionedInQuestion(value, candidateText),
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

export function resultReferences(
  result: DatasetQueryResult,
  source: Dataset,
  query: DatasetQuery,
): QueryResultReference[] {
  const rows = new Map(source.rows.map((row) => [row.id, row]));
  const metricUnits = new Map(
    (query.metrics ?? []).flatMap((metric) => {
      const unit = metric.fieldId
        ? source.columns.find((column) => column.id === metric.fieldId)?.unit
        : undefined;
      return unit ? [[metric.id, unit] as const] : [];
    }),
  );
  const metricEvidence = (metrics: Record<string, number | null>) =>
    Object.entries(metrics).flatMap(([id, value]) =>
      value === null
        ? []
        : [
            {
              value,
              ...(metricUnits.get(id)
                ? { unit: metricUnits.get(id) as string }
                : {}),
            },
          ],
    );
  const queryNumericEvidence = metricEvidence(result.metrics);
  const references: QueryResultReference[] = [
    {
      id: `query-${result.queryId}`,
      excerpt: boundedEvidence(
        `Метрики: ${JSON.stringify(result.metrics)}; найдено строк: ${result.matchedRows}; просмотрено строк: ${result.scannedRows}.`,
      ),
      numericValues: queryNumericEvidence.map((item) => item.value),
      numericEvidence: queryNumericEvidence,
    },
  ];
  references[0]?.numericValues?.push(result.matchedRows, result.scannedRows);
  references[0]?.numericEvidence?.push(
    { value: result.matchedRows },
    { value: result.scannedRows },
  );
  for (const [index, group] of result.groups.entries()) {
    const groupNumericEvidence = metricEvidence(group.metrics);
    references.push({
      id: `group-${result.queryId}-${index}`,
      excerpt: boundedEvidence(
        `Группа ${String(group.key)}; метрики: ${JSON.stringify(group.metrics)}.`,
      ),
      numericValues: [
        ...(typeof group.key === "number" ? [group.key] : []),
        ...groupNumericEvidence.map((item) => item.value),
      ],
      numericEvidence: [
        ...(typeof group.key === "number" ? [{ value: group.key }] : []),
        ...groupNumericEvidence,
      ],
    });
  }
  const seen = new Set<string>();
  for (const reference of [
    ...result.rowReferences,
    ...result.groups.flatMap((group) => group.rowReferences),
  ]) {
    if (seen.has(reference.rowId)) continue;
    const row = rows.get(reference.rowId);
    if (!row) continue;
    seen.add(reference.rowId);
    const rowEvidence = sourceReferences({ ...source, rows: [row] })[0];
    if (!rowEvidence?.excerpt) continue;
    references.push({
      id: `row-${row.id}`,
      excerpt: rowEvidence.excerpt,
      ...(rowEvidence.numericValues
        ? { numericValues: rowEvidence.numericValues }
        : {}),
      ...(rowEvidence.numericEvidence
        ? { numericEvidence: rowEvidence.numericEvidence }
        : {}),
    });
    if (references.length >= 100) break;
  }
  return references;
}
