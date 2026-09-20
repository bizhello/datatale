import {
  DATASET_QUERY_MAX_GROUPS,
  type DatasetQuery,
  type DatasetQueryFilter,
  type DatasetQueryResult,
  datasetQuerySchema,
  type NormalizedDatasetQuery,
} from "./query";
import type { Dataset, DatasetRow } from "./schema";

type Scalar = string | number | boolean | null;
type Column = Dataset["columns"][number];
type QueryField = string | { fieldId: string };

function fieldId(field: QueryField): string {
  return typeof field === "string" ? field : field.fieldId;
}

function fail(message: string): never {
  throw new Error(`Invalid dataset query: ${message}`);
}
function column(dataset: Dataset, fieldId: string): Column {
  const found = dataset.columns.find((item) => item.id === fieldId);
  if (!found) fail(`Unknown field "${fieldId}".`);
  return found;
}
function valueType(value: Scalar): string {
  return value === null ? "null" : typeof value;
}
function compatible(value: Scalar, scalarType: Column["scalarType"]): boolean {
  if (value === null) return true;
  if (scalarType === "date")
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return valueType(value) === scalarType;
}
function comparable(a: Scalar, b: Scalar): boolean {
  return (
    a !== null &&
    b !== null &&
    typeof a === typeof b &&
    (typeof a === "string" || typeof a === "number")
  );
}
function matches(
  row: DatasetRow,
  filter: DatasetQueryFilter,
  dataset: Dataset,
): boolean {
  const field = column(dataset, filter.fieldId);
  const actual = row.values[filter.fieldId] as Scalar;
  const expected = filter.value;
  if (Array.isArray(expected)) {
    if (filter.operator !== "in")
      fail("The in operator requires an array value.");
    for (const item of expected)
      if (!compatible(item, field.scalarType))
        fail(`Value for "${filter.fieldId}" does not match its column type.`);
    return (
      actual !== null &&
      expected.some((item) => item !== null && actual === item)
    );
  }
  if (filter.operator === "in")
    fail("The in operator requires an array value.");
  if (!compatible(expected, field.scalarType))
    fail(`Value for "${filter.fieldId}" does not match its column type.`);
  if (filter.operator === "contains") {
    if (
      expected === null ||
      actual === null ||
      typeof actual !== "string" ||
      typeof expected !== "string"
    )
      fail("contains requires a non-null string field and value.");
    return actual.includes(expected);
  }
  if (actual === null || expected === null) {
    if (filter.operator === "eq") return actual === expected;
    if (filter.operator === "ne") return expected === null && actual !== null;
    return false;
  }
  if (filter.operator === "eq") return actual === expected;
  if (filter.operator === "ne") return actual !== expected;
  if (!comparable(actual, expected))
    fail("Range comparisons require matching string or number values.");
  if (filter.operator === "lt") return actual < expected;
  if (filter.operator === "lte") return actual <= expected;
  if (filter.operator === "gt") return actual > expected;
  return actual >= expected;
}
function addNumbers(values: number[]): number | null {
  if (values.length === 0) return null;
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
function aggregate(
  rows: DatasetRow[],
  metric: NormalizedDatasetQuery["metrics"][number],
  dataset: Dataset,
): number | null {
  const values =
    metric.fieldId === undefined
      ? rows.map(() => 1)
      : rows
          .map((row) => row.values[metric.fieldId as string] as Scalar)
          .filter((value): value is Exclude<Scalar, null> => value !== null);
  if (metric.fieldId !== undefined) {
    const field = column(dataset, metric.fieldId);
    if (
      metric.aggregation !== "count" &&
      metric.aggregation !== "distinctCount" &&
      field.scalarType !== "number"
    )
      fail(`Aggregation ${metric.aggregation} requires a numeric field.`);
    if (metric.aggregation === "distinctCount") return new Set(values).size;
  }
  if (metric.aggregation === "count") return values.length;
  const numbers = values.filter(
    (value): value is number => typeof value === "number",
  );
  if (numbers.length === 0) return null;
  if (metric.aggregation === "sum") return addNumbers(numbers);
  if (metric.aggregation === "average")
    return (addNumbers(numbers) as number) / numbers.length;
  if (metric.aggregation === "min") return Math.min(...numbers);
  return Math.max(...numbers);
}

export function executeDatasetQuery(
  dataset: Dataset,
  input: DatasetQuery,
): DatasetQueryResult {
  const query = datasetQuerySchema.parse(input);
  for (const selectedField of query.select)
    column(dataset, fieldId(selectedField));
  if (query.groupBy) column(dataset, fieldId(query.groupBy));
  for (const filter of query.filters) column(dataset, filter.fieldId);
  for (const metric of query.metrics)
    if (metric.fieldId) column(dataset, metric.fieldId);
  for (const order of query.orderBy) {
    if (order.fieldId) column(dataset, order.fieldId);
    else if (!query.metrics.some((metric) => metric.id === order.metricId))
      fail(`Unknown metric "${order.metricId}".`);
  }
  const matched = dataset.rows.filter((row) =>
    query.filters.every((filter) => matches(row, filter, dataset)),
  );
  const metrics = Object.fromEntries(
    query.metrics.map((metric) => [
      metric.id,
      aggregate(matched, metric, dataset),
    ]),
  );
  const groups = new Map<Scalar, DatasetRow[]>();
  if (query.groupBy)
    for (const row of matched) {
      const key = row.values[fieldId(query.groupBy)] as Scalar;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
  if (groups.size > DATASET_QUERY_MAX_GROUPS)
    fail("Group count exceeds the query bound.");
  let groupResults = [...groups.entries()].map(([key, rows]) => ({
    key,
    metrics: Object.fromEntries(
      query.metrics.map((metric) => [
        metric.id,
        aggregate(rows, metric, dataset),
      ]),
    ),
    rowReferences: rows.slice(0, DATASET_QUERY_MAX_GROUPS).map(reference),
  }));
  const metricOrder = query.orderBy.find((order) => order.metricId);
  if (metricOrder) {
    if (!query.groupBy) fail("Metric ordering requires groupBy.");
    groupResults = groupResults.sort((a, b) => {
      const av = a.metrics[metricOrder.metricId as string];
      const bv = b.metrics[metricOrder.metricId as string];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const comparison = av < bv ? -1 : 1;
      return metricOrder.direction === "asc" ? comparison : -comparison;
    });
  }
  const fieldOrder = query.orderBy.find((order) => order.fieldId);
  if (fieldOrder && query.groupBy) {
    groupResults = groupResults.sort((a, b) => {
      if (a.key === b.key) return 0;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      const comparison = String(a.key).localeCompare(String(b.key));
      return fieldOrder.direction === "asc" ? comparison : -comparison;
    });
  }
  const orderValue = (
    row: DatasetRow,
    order: NormalizedDatasetQuery["orderBy"][number],
  ): Scalar =>
    order.fieldId
      ? (row.values[order.fieldId] as Scalar)
      : (metrics[order.metricId as string] ?? null);
  const ordered = matched
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const order of query.orderBy) {
        const av = orderValue(a.row, order);
        const bv = orderValue(b.row, order);
        if (av === bv) continue;
        if (av === null) return 1;
        if (bv === null) return -1;
        const comparison = av < bv ? -1 : 1;
        return order.direction === "asc" ? comparison : -comparison;
      }
      return a.index - b.index;
    });
  const returned = ordered.slice(0, query.limit);
  return {
    queryId: query.queryId,
    rows: returned.map(({ row }) =>
      Object.fromEntries(
        query.select.map((selectedField) => [
          fieldId(selectedField),
          row.values[fieldId(selectedField)] as Scalar,
        ]),
      ),
    ),
    groups: groupResults.slice(0, query.limit),
    metrics,
    matchedRows: matched.length,
    scannedRows: dataset.rows.length,
    returnedRows: returned.length,
    truncated: matched.length > query.limit,
    rowReferences: returned.map(({ row }) => reference(row)),
  };
}
function reference(row: DatasetRow) {
  return { rowId: row.id, sourceRowNumber: row.provenance.sourceRowNumber };
}
