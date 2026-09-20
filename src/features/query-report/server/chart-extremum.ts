import type { FinalReport } from "@/entities/report";

type Extremum = "maximum" | "minimum";

export type ChartExtremum = Readonly<{
  answer: string;
  evidenceId: string;
}>;

function words(value: string) {
  return value.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function wordKey(value: string) {
  return value.length > 4 ? value.slice(0, 5) : value;
}

function mentions(questionWords: string[], label: string) {
  const labelWords = words(label).filter((word) => word.length > 2);
  return (
    labelWords.length > 0 &&
    labelWords.every((labelWord) => {
      const key = wordKey(labelWord);
      return questionWords.some(
        (questionWord) => wordKey(questionWord) === key,
      );
    })
  );
}

function requestedExtremum(question: string): Extremum | undefined {
  const normalized = question.toLocaleLowerCase("ru-RU");
  if (
    /(?:больше всего|наибольш|максим|сам(?:ый|ая|ое|ые)?\s+(?:больш|высок)|\b(?:max|highest|largest)\b)/u.test(
      normalized,
    )
  )
    return "maximum";
  if (
    /(?:меньше всего|наименьш|миним|сам(?:ый|ая|ое|ые)?\s+(?:мал|низк)|\b(?:min|lowest|smallest)\b)/u.test(
      normalized,
    )
  )
    return "minimum";
  return undefined;
}

function numberText(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(
    value,
  );
}

export function chartExtremum(
  question: string,
  report: FinalReport,
): ChartExtremum | undefined {
  const extremum = requestedExtremum(question);
  if (!extremum) return undefined;
  const questionWords = words(question);
  const candidates = report.charts
    .filter((chart) => chart.points.length > 0)
    .map((chart) => {
      const dimensionScore = mentions(
        questionWords,
        chart.aggregation.dimensionLabel,
      )
        ? 1
        : 0;
      const measureLabel =
        chart.aggregation.kind === "count"
          ? "Количество строк"
          : chart.aggregation.fieldLabel;
      const measureScore = mentions(questionWords, measureLabel) ? 2 : 0;
      return { chart, measureLabel, score: dimensionScore + measureScore };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  const candidate = candidates[0];
  if (!candidate || candidates[1]?.score === candidate.score) return undefined;
  const values = candidate.chart.points.map((point) => point.value);
  const value =
    extremum === "maximum" ? Math.max(...values) : Math.min(...values);
  const labels = candidate.chart.points
    .filter((point) => Object.is(point.value, value))
    .map((point) => `«${point.label}»`)
    .join(", ");
  const evidenceId = candidate.chart.evidenceIds[0];
  if (!labels || !evidenceId) return undefined;
  const prefix = extremum === "maximum" ? "Максимум" : "Минимум";
  return {
    answer: `${prefix} по показателю «${candidate.measureLabel}» — ${labels}: ${numberText(value)}${candidate.chart.unit ? ` ${candidate.chart.unit}` : ""}.`,
    evidenceId,
  };
}
