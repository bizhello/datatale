import type { Dataset } from "@/entities/dataset";
import type {
  Aggregation,
  ChartSpecification,
  MetricSpecification,
  ReportCalculation,
  ReportChartCalculation,
} from "@/entities/report";
import { metricLabel } from "./report-copy";

type Point = { label: string; value: number };
type Group = { label: string; rows: Dataset["rows"] };

function compensatedSum(values: number[]) {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = sum + adjusted;
    correction = next - sum - adjusted;
    sum = next;
  }
  return sum;
}

export function reportCalculation(
  source: Dataset,
  aggregation: Aggregation,
): ReportCalculation {
  if (aggregation.kind === "count") return { kind: "count" };
  const field = source.columns.find(
    (column) => column.id === aggregation.field.fieldId,
  );
  if (!field) throw new Error("Calculation references an unknown field.");
  return {
    kind: aggregation.kind,
    fieldId: field.id,
    fieldLabel: field.label,
  };
}
export function reportChartCalculation(
  source: Dataset,
  aggregation: Aggregation,
  dimensionFieldId: string,
): ReportChartCalculation {
  const dimension = source.columns.find(
    (column) => column.id === dimensionFieldId,
  );
  if (!dimension)
    throw new Error("Calculation references an unknown dimension.");
  if (aggregation.kind === "count")
    return {
      kind: "count",
      dimensionFieldId: dimension.id,
      dimensionLabel: dimension.label,
    };
  const field = source.columns.find(
    (column) => column.id === aggregation.field.fieldId,
  );
  if (!field) throw new Error("Calculation references an unknown field.");
  return {
    kind: aggregation.kind,
    fieldId: field.id,
    fieldLabel: field.label,
    dimensionFieldId: dimension.id,
    dimensionLabel: dimension.label,
  };
}
export function aggregateRows(
  rows: Dataset["rows"],
  aggregation: Aggregation,
): number {
  if (aggregation.kind === "count") return rows.length;
  const values = rows
    .map((row) => row.values[aggregation.field.fieldId])
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return 0;
  if (aggregation.kind === "sum") return compensatedSum(values);
  if (aggregation.kind === "average")
    return compensatedSum(values) / values.length;
  if (aggregation.kind === "min") return Math.min(...values);
  return Math.max(...values);
}
export function calculateMetric(
  source: Dataset,
  specification: MetricSpecification,
) {
  const numeric =
    specification.aggregation.kind === "count"
      ? undefined
      : specification.aggregation;
  const unit = numeric
    ? source.columns.find((column) => column.id === numeric.field.fieldId)?.unit
    : undefined;
  return {
    id: specification.id,
    label: metricLabel(source, specification.aggregation),
    value: aggregateRows(source.rows, specification.aggregation),
    calculation: reportCalculation(source, specification.aggregation),
    ...(unit ? { unit } : {}),
  };
}
export function calculateChart(
  source: Dataset,
  specification: ChartSpecification,
): Point[] {
  const groups = new Map<string, Dataset["rows"]>();
  for (const row of source.rows) {
    const raw = row.values[specification.dimension.fieldId];
    if (raw === null) continue;
    const label = String(raw);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  const grouped = [...groups].map(([label, rows]): Group => ({ label, rows }));
  const points = grouped.map(({ label, rows }) => ({
    label,
    value: aggregateRows(rows, specification.aggregation),
  }));
  if (specification.kind === "line")
    return points
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, specification.pointLimit);
  const ordered = grouped
    .map(({ label, rows }) => ({
      label,
      rows,
      value: aggregateRows(rows, specification.aggregation),
    }))
    .sort((a, b) => b.value - a.value);
  if (specification.kind === "bar" && specification.topN) {
    const selected = ordered.slice(0, specification.topN.count);
    const other = ordered.slice(specification.topN.count);
    const result = selected.map(({ label, value }) => ({ label, value }));
    if (other.length)
      result.push({
        label: "Другие",
        value: aggregateRows(
          other.flatMap((group) => group.rows),
          specification.aggregation,
        ),
      });
    return result;
  }
  return ordered
    .slice(
      0,
      specification.kind === "bar"
        ? specification.categoryLimit
        : specification.segmentLimit,
    )
    .map(({ label, value }) => ({ label, value }));
}
