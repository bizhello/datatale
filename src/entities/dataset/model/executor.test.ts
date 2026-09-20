import { describe, expect, it } from "vitest";

import { executeDatasetQuery } from "@/entities/dataset";
import { syntheticDatasetFixture } from "../../../../tests/fixtures/dataset";

describe("executeDatasetQuery", () => {
  it("filters, projects, preserves provenance, and scans before limiting", () => {
    const result = executeDatasetQuery(syntheticDatasetFixture, {
      queryId: "filter-test",
      filters: [{ fieldId: "revenue", operator: "gt", value: 100 }],
      select: ["date", "revenue"],
      limit: 1,
    });

    expect(result.rows).toEqual([{ date: "2026-01-31", revenue: 1200 }]);
    expect(result.matchedRows).toBe(1);
    expect(result.scannedRows).toBe(2);
    expect(result.rowReferences).toEqual([
      { rowId: "row-1", sourceRowNumber: 2 },
    ]);
  });

  it("supports membership, null inequality, ranges, and deterministic ordering", () => {
    const result = executeDatasetQuery(syntheticDatasetFixture, {
      queryId: "operators-test",
      filters: [
        { fieldId: "revenue", operator: "in", value: [null, 1200] },
        { fieldId: "revenue", operator: "ne", value: null },
        { fieldId: "revenue", operator: "gte", value: 1000 },
      ],
      select: ["revenue"],
      orderBy: [{ fieldId: "revenue", direction: "desc" }],
      limit: 1,
    });
    expect(result.rows).toEqual([{ revenue: 1200 }]);
    expect(result.truncated).toBe(false);
  });

  it("treats absent values as null for contains", () => {
    const result = executeDatasetQuery(
      {
        ...syntheticDatasetFixture,
        rows: [
          ...syntheticDatasetFixture.rows,
          {
            id: "null-note",
            values: { date: "2026-03-01", revenue: 1, paid: false, note: null },
            provenance: { sourceRowNumber: 4 },
          },
        ],
      },
      {
        queryId: "null-contains",
        filters: [{ fieldId: "note", operator: "contains", value: "January" }],
        select: ["note"],
      },
    );
    expect(result.matchedRows).toBe(1);
  });

  it("supports contains, grouping, and every aggregate with nulls ignored", () => {
    const dataset = {
      ...syntheticDatasetFixture,
      rows: [
        ...syntheticDatasetFixture.rows,
        {
          id: "row-3",
          values: {
            date: "2026-03-01",
            revenue: 800,
            paid: true,
            note: "January return",
          },
          provenance: { sourceRowNumber: 4 },
        },
      ],
    };
    const result = executeDatasetQuery(dataset, {
      queryId: "aggregate-test",
      filters: [{ fieldId: "note", operator: "contains", value: "January" }],
      groupBy: { fieldId: "paid" },
      select: ["note"],
      metrics: [
        { id: "count", aggregation: "count" },
        { id: "sum", aggregation: "sum", fieldId: "revenue" },
        { id: "average", aggregation: "average", fieldId: "revenue" },
        { id: "min", aggregation: "min", fieldId: "revenue" },
        { id: "max", aggregation: "max", fieldId: "revenue" },
        { id: "distinct", aggregation: "distinctCount", fieldId: "revenue" },
      ],
    });

    expect(result.metrics).toEqual({
      count: 2,
      sum: 2000,
      average: 1000,
      min: 800,
      max: 1200,
      distinct: 2,
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.key).toBe(true);
  });

  it("orders grouped numeric metrics with all order clauses", () => {
    const dataset = {
      ...syntheticDatasetFixture,
      rows: [
        {
          id: "a",
          values: { date: "2026-01-01", revenue: 2, paid: false, note: "a" },
          provenance: { sourceRowNumber: 2 },
        },
        {
          id: "b",
          values: { date: "2026-01-01", revenue: 10, paid: true, note: "b" },
          provenance: { sourceRowNumber: 3 },
        },
        {
          id: "c",
          values: { date: "2026-01-01", revenue: 1, paid: false, note: "c" },
          provenance: { sourceRowNumber: 4 },
        },
      ],
    };
    const result = executeDatasetQuery(dataset, {
      queryId: "group-order",
      groupBy: { fieldId: "paid" },
      metrics: [{ id: "sum", aggregation: "sum", fieldId: "revenue" }],
      orderBy: [
        { fieldId: "paid", direction: "asc" },
        { metricId: "sum", direction: "desc" },
      ],
    });
    expect(
      result.groups.map((group) => [group.key, group.metrics.sum]),
    ).toEqual([
      [false, 3],
      [true, 10],
    ]);
  });

  it("rejects unknown fields, incompatible values, and numeric aggregates on text", () => {
    expect(() =>
      executeDatasetQuery(syntheticDatasetFixture, {
        queryId: "invalid-field",
        filters: [{ fieldId: "missing", operator: "eq", value: "x" }],
      }),
    ).toThrow(/Unknown field/);
    expect(() =>
      executeDatasetQuery(syntheticDatasetFixture, {
        queryId: "invalid-value",
        filters: [{ fieldId: "revenue", operator: "eq", value: "x" }],
      }),
    ).toThrow(/does not match/);
    expect(() =>
      executeDatasetQuery(syntheticDatasetFixture, {
        queryId: "invalid-aggregate",
        metrics: [{ id: "sum", aggregation: "sum", fieldId: "note" }],
      }),
    ).toThrow(/numeric/);
  });

  it("returns rows matching only at the dataset boundary and reports truncation", () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      id: `row-${index}`,
      values: {
        date: "2026-01-01",
        revenue: index,
        paid: false,
        note: index === 4_999 ? "needle" : "x",
      },
      provenance: { sourceRowNumber: index + 1 },
    }));
    const result = executeDatasetQuery(
      { ...syntheticDatasetFixture, rows },
      {
        queryId: "boundary-test",
        filters: [{ fieldId: "note", operator: "eq", value: "needle" }],
        select: ["note"],
        limit: 1,
      },
    );
    expect(result.matchedRows).toBe(1);
    expect(result.scannedRows).toBe(5_000);
    expect(result.rowReferences[0]).toEqual({
      rowId: "row-4999",
      sourceRowNumber: 5_000,
    });
    expect(result.truncated).toBe(false);
  });
});
