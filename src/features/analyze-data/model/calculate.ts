import type { Dataset } from "@/entities/dataset";
import type {
  Aggregation,
  ChartSpecification,
  MetricSpecification,
} from "@/entities/report";

type Point = { label: string; value: number };
type Group = { label: string; rows: Dataset["rows"] };
export function aggregateRows(
  rows: Dataset["rows"],
  aggregation: Aggregation,
): number {
  if (aggregation.kind === "count") return rows.length;
  const values = rows
    .map((row) => row.values[aggregation.field.fieldId])
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return 0;
  if (aggregation.kind === "sum")
    return values.reduce((sum, value) => sum + value, 0);
  if (aggregation.kind === "average")
    return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  const fieldLabel = numeric
    ? source.columns.find((column) => column.id === numeric.field.fieldId)
        ?.label
    : undefined;
  return {
    id: specification.id,
    label: specification.label,
    value: aggregateRows(source.rows, specification.aggregation),
    calculation: {
      kind: specification.aggregation.kind,
      ...(fieldLabel ? { fieldLabel } : {}),
    },
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
        label: "Other",
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
