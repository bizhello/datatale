import type { Dataset } from "@/entities/dataset";
import {
  type Aggregation,
  type ChartSpecification,
  REPORT_LABEL_MAX_LENGTH,
  REPORT_RATIONALE_MAX_LENGTH,
  REPORT_TITLE_MAX_LENGTH,
} from "@/entities/report";

function bounded(value: string, limit: number) {
  return value.length <= limit
    ? value
    : `${value.slice(0, limit - 1).trimEnd()}…`;
}

function fieldLabel(source: Dataset, fieldId: string) {
  const field = source.columns.find((column) => column.id === fieldId);
  if (!field) throw new Error("Report copy references an unknown field.");
  return field.label;
}

function aggregationLabel(source: Dataset, aggregation: Aggregation) {
  if (aggregation.kind === "count") return "Количество строк";
  const label = fieldLabel(source, aggregation.field.fieldId);
  const prefix = {
    sum: "Сумма",
    average: "Среднее",
    min: "Минимум",
    max: "Максимум",
  }[aggregation.kind];
  return `${prefix}: ${label}`;
}

function aggregationPhrase(source: Dataset, aggregation: Aggregation) {
  if (aggregation.kind === "count") return "количество строк";
  const label = fieldLabel(source, aggregation.field.fieldId);
  const prefix = {
    sum: "сумма",
    average: "среднее",
    min: "минимум",
    max: "максимум",
  }[aggregation.kind];
  return `${prefix} «${label}»`;
}

export function metricLabel(source: Dataset, aggregation: Aggregation) {
  return bounded(
    aggregationLabel(source, aggregation),
    REPORT_LABEL_MAX_LENGTH,
  );
}

export function chartCopy(source: Dataset, chart: ChartSpecification) {
  const dimension = fieldLabel(source, chart.dimension.fieldId);
  const measure = aggregationPhrase(source, chart.aggregation);
  const titlePrefix =
    chart.kind === "line"
      ? "Динамика"
      : chart.kind === "donut"
        ? "Доли"
        : "Сравнение";
  const rationale = {
    bar: "Столбчатая диаграмма наглядно сравнивает значения между категориями.",
    line: "Линейный график показывает изменение показателя по упорядоченным периодам.",
    donut:
      "Кольцевая диаграмма показывает вклад каждой категории в общий результат.",
  }[chart.kind];
  return {
    title: bounded(
      `${titlePrefix} по полю «${dimension}»: ${measure}`,
      REPORT_TITLE_MAX_LENGTH,
    ),
    rationale: bounded(rationale, REPORT_RATIONALE_MAX_LENGTH),
  };
}
