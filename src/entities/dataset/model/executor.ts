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
type GroupBy =
  | string
  | {
      fieldId: string;
      dateBucket?: "day" | "month" | "quarter" | "year" | undefined;
    };

function fieldId(field: QueryField): string {
  return typeof field === "string" ? field : field.fieldId;
}
function groupKey(row: DatasetRow, groupBy: GroupBy): Scalar {
  const reference =
    typeof groupBy === "string" ? { fieldId: groupBy } : groupBy;
  const value = row.values[reference.fieldId] as Scalar;
  if (
    value === null ||
    reference.dateBucket === undefined ||
    reference.dateBucket === "day"
  )
    return value;
  if (typeof value !== "string") fail("Date buckets require a date field.");
  if (reference.dateBucket === "month") return value.slice(0, 7);
  if (reference.dateBucket === "quarter")
    return `${value.slice(0, 4)}-Q${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1}`;
  return value.slice(0, 4);
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
function compareValues(a: Scalar, b: Scalar): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
function validateFilter(filter: DatasetQueryFilter, dataset: Dataset): void {
  const field = column(dataset, filter.fieldId);
  const values = Array.isArray(filter.value) ? filter.value : [filter.value];
  if (Array.isArray(filter.value) && filter.operator !== "in")
    fail("The in operator requires an array value.");
  if (!Array.isArray(filter.value) && filter.operator === "in")
    fail("The in operator requires an array value.");
  if (
    filter.operator === "contains" &&
    (field.scalarType !== "string" ||
      filter.value === null ||
      Array.isArray(filter.value) ||
      typeof filter.value !== "string")
  )
    fail("contains requires a non-null string field and value.");
  if (
    ["lt", "lte", "gt", "gte"].includes(filter.operator) &&
    !["string", "number", "date"].includes(field.scalarType)
  )
    fail("Range comparisons require a string, number, or date field.");
  for (const value of values)
    if (!compatible(value, field.scalarType))
      fail(`Value for "${filter.fieldId}" does not match its column type.`);
}
function matches(
  row: DatasetRow,
  filter: DatasetQueryFilter,
  dataset: Dataset,
): boolean {
  const field = column(dataset, filter.fieldId);
  const actualValue = row.values[filter.fieldId] as Scalar | undefined;
  const actual: Scalar = actualValue === undefined ? null : actualValue;
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
    if (actual === null) return false;
    if (
      expected === null ||
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
  if (numbers.length === 0)
    return metric.aggregation === "sum" && rows.length === 0 ? 0 : null;
  if (metric.aggregation === "sum") return addNumbers(numbers);
  if (metric.aggregation === "average")
    return (addNumbers(numbers) as number) / numbers.length;
  if (metric.aggregation === "min") return Math.min(...numbers);
  return Math.max(...numbers);
}

export function validateDatasetQuery(
  dataset: Dataset,
  input: DatasetQuery,
): NormalizedDatasetQuery {
  const query = datasetQuerySchema.parse(input);
  for (const selectedField of query.select)
    column(dataset, fieldId(selectedField));
  if (query.groupBy) {
    const groupedColumn = column(dataset, fieldId(query.groupBy));
    if (
      typeof query.groupBy !== "string" &&
      "dateBucket" in query.groupBy &&
      query.groupBy.dateBucket &&
      groupedColumn.scalarType !== "date"
    )
      fail("Date buckets require a date field.");
  }
  for (const filter of query.filters) column(dataset, filter.fieldId);
  for (const filter of query.filters) validateFilter(filter, dataset);
  for (const metric of query.metrics)
    if (metric.fieldId) column(dataset, metric.fieldId);
  for (const order of query.orderBy) {
    if (order.fieldId) column(dataset, order.fieldId);
    else if (!query.metrics.some((metric) => metric.id === order.metricId))
      fail(`Unknown metric "${order.metricId}".`);
  }
  return query;
}

export function executeDatasetQuery(
  dataset: Dataset,
  input: DatasetQuery,
): DatasetQueryResult {
  const query = validateDatasetQuery(dataset, input);
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
      const key = groupKey(row, query.groupBy);
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
  if (query.orderBy.some((order) => order.metricId) && !query.groupBy)
    fail("Metric ordering requires groupBy.");
  if (query.groupBy && query.orderBy.length > 0) {
    const groupedField = fieldId(query.groupBy);
    groupResults = groupResults.sort((a, b) => {
      for (const order of query.orderBy) {
        const av = order.metricId
          ? (a.metrics[order.metricId] ?? null)
          : order.fieldId === groupedField
            ? a.key
            : null;
        const bv = order.metricId
          ? (b.metrics[order.metricId] ?? null)
          : order.fieldId === groupedField
            ? b.key
            : null;
        const comparison = compareValues(av, bv);
        if (comparison !== 0)
          return av === null || bv === null
            ? comparison
            : order.direction === "asc"
              ? comparison
              : -comparison;
      }
      return 0;
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
        const comparison = compareValues(av, bv);
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
