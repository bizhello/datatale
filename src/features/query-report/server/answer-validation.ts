import { type ArithmeticInput, validateArithmetic } from "./arithmetic";
import { isoDateValues, numericValues } from "./source-context";

type QueryResultReference = {
  id: string;
  excerpt?: string;
  numericValues?: number[];
  numericEvidence?: { value: number; unit?: string }[];
  isoDates?: string[];
};

const russianMonth =
  /(?:(\d{1,2})\s+)?(январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йяею]|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*)(?:\s+(\d{4})(?:\s+г(?:од(?:а|у|ом|е)?)?\.?)?)?/giu;
const monthNumber = (value: string) => {
  const normalized = value.toLocaleLowerCase("ru-RU");
  const stems = [
    "январ",
    "феврал",
    "март",
    "апрел",
    "ма",
    "июн",
    "июл",
    "август",
    "сентябр",
    "октябр",
    "ноябр",
    "декабр",
  ];
  return stems.findIndex((stem) => normalized.startsWith(stem)) + 1;
};
type LocalizedDate = { day?: number; month: number; year?: number };

function localizedDates(value: string): LocalizedDate[] {
  return [...value.matchAll(russianMonth)].map((match) => ({
    ...(match[1] ? { day: Number(match[1]) } : {}),
    month: monthNumber(match[2] ?? ""),
    ...(match[3] ? { year: Number(match[3]) } : {}),
  }));
}

function localizedDateNumbers(
  answer: string,
  evidenceDates: Set<string>,
  evidenceExcerpts: string[],
) {
  const numbers = new Set<number>();
  const localizedEvidence = evidenceExcerpts.flatMap(localizedDates);
  for (const date of localizedDates(answer)) {
    const supported =
      [...evidenceDates].some((sourceDate) => {
        const [sourceYear, sourceMonth, sourceDay] = sourceDate
          .split("-")
          .map(Number);
        return (
          sourceMonth === date.month &&
          (date.day === undefined || sourceDay === date.day) &&
          (date.year === undefined || sourceYear === date.year)
        );
      }) ||
      localizedEvidence.some(
        (source) =>
          source.month === date.month &&
          (date.day === undefined || source.day === date.day) &&
          (date.year === undefined || source.year === date.year),
      );
    if (!supported)
      throw new Error("Answer contains a date absent from cited evidence.");
    if (date.day !== undefined) numbers.add(date.day);
    if (date.year !== undefined) numbers.add(date.year);
  }
  return numbers;
}

export function validateAnswerReferences(
  answer: string,
  references: Array<{ id: string; excerpt?: string | undefined }>,
  evidence: Map<string, QueryResultReference>,
  requiredId?: string,
  arithmetic?: ArithmeticInput,
) {
  if (references.length < 1 || references.length > 7)
    throw new Error("Answer must cite source references.");
  const seen = new Set<string>();
  const trusted = references.map((reference) => {
    if (seen.has(reference.id) || !evidence.has(reference.id))
      throw new Error("Answer cited unknown or duplicate source reference.");
    seen.add(reference.id);
    return {
      id: reference.id,
      excerpt: evidence.get(reference.id)?.excerpt as string,
    };
  });
  if (requiredId && !seen.has(requiredId))
    throw new Error("Numeric answer must cite the query result reference.");
  const evidenceNumbers = new Set(
    trusted.flatMap(
      (reference) => evidence.get(reference.id)?.numericValues ?? [],
    ),
  );
  const evidenceDates = new Set(
    trusted.flatMap((reference) => evidence.get(reference.id)?.isoDates ?? []),
  );
  const dateNumbers = localizedDateNumbers(
    answer,
    evidenceDates,
    trusted.map((reference) => reference.excerpt),
  );
  const derivedValue = arithmetic
    ? validateArithmetic(arithmetic, seen, evidence)
    : undefined;
  for (const value of numericValues(answer))
    if (
      !dateNumbers.has(value) &&
      !evidenceNumbers.has(value) &&
      (derivedValue === undefined ||
        Math.abs(value - derivedValue) >
          1e-9 * Math.max(1, Math.abs(derivedValue)))
    )
      throw new Error("Answer contains a number absent from cited evidence.");
  for (const date of isoDateValues(answer))
    if (!evidenceDates.has(date))
      throw new Error("Answer contains a date absent from cited evidence.");
  return trusted;
}
