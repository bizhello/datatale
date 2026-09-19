import { describe, expect, it } from "vitest";
import type { Dataset } from "@/entities/dataset";
import { calculateChart, calculateMetric } from "./calculate";
import { profileSource } from "./profile";

const source: Dataset = {
  version: 1,
  id: "all-rows",
  source: { kind: "csv" },
  columns: [
    { id: "month", label: "Month", scalarType: "date" },
    { id: "region", label: "Region", scalarType: "string" },
    { id: "revenue", label: "Revenue", scalarType: "number", unit: "RUB" },
  ],
  rows: [
    {
      id: "1",
      values: { month: "2026-02-01", region: "North", revenue: 10 },
      provenance: { sourceRowNumber: 2 },
    },
    {
      id: "2",
      values: { month: "2026-01-01", region: "North", revenue: 20 },
      provenance: { sourceRowNumber: 3 },
    },
    {
      id: "3",
      values: { month: "2026-02-01", region: "South", revenue: 30 },
      provenance: { sourceRowNumber: 4 },
    },
  ],
};

describe("analysis calculations", () => {
  it("uses all accepted rows for metrics and retains their unit", () => {
    expect(
      calculateMetric(source, {
        id: "total",
        label: "Total",
        aggregation: { kind: "sum", field: { fieldId: "revenue" } },
      }),
    ).toEqual({
      id: "total",
      label: "Total",
      value: 60,
      unit: "RUB",
      calculation: { kind: "sum", fieldLabel: "Revenue" },
    });
    expect(
      profileSource(source).fields.find((field) => field.id === "region"),
    ).toMatchObject({ distinct: 2, missing: 0 });
  });
  it("aggregates grouped values and puts time points in chronological order", () => {
    expect(
      calculateChart(source, {
        id: "trend",
        kind: "line",
        title: "Trend",
        rationale: "time",
        dimension: { fieldId: "month" },
        aggregation: { kind: "sum", field: { fieldId: "revenue" } },
        pointLimit: 24,
        missingPeriodPolicy: "reject",
      }),
    ).toEqual([
      { label: "2026-01-01", value: 20 },
      { label: "2026-02-01", value: 40 },
    ]);
  });

  it.each([
    [
      "sum",
      [
        { label: "A", value: 100 },
        { label: "C", value: 100 },
        { label: "Other", value: 140 },
      ],
    ],
    [
      "count",
      [
        { label: "D", value: 3 },
        { label: "C", value: 2 },
        { label: "Other", value: 2 },
      ],
    ],
    [
      "average",
      [
        { label: "A", value: 100 },
        { label: "B", value: 80 },
        { label: "Other", value: 32 },
      ],
    ],
    [
      "min",
      [
        { label: "A", value: 100 },
        { label: "B", value: 80 },
        { label: "Other", value: 1 },
      ],
    ],
    [
      "max",
      [
        { label: "A", value: 100 },
        { label: "C", value: 99 },
        { label: "Other", value: 80 },
      ],
    ],
  ] as const)(
    "calculates Other from source rows for a top-N %s aggregation",
    (kind, expected) => {
      const topNRows: Array<[string, number]> = [
        ["A", 100],
        ["B", 80],
        ["C", 1],
        ["C", 99],
        ["D", 20],
        ["D", 20],
        ["D", 20],
      ];
      const topNSource: Dataset = {
        version: 1,
        id: "top-n",
        source: { kind: "csv" },
        columns: [
          { id: "category", label: "Category", scalarType: "string" },
          { id: "value", label: "Value", scalarType: "number" },
        ],
        rows: topNRows.map(([category, value], index) => ({
          id: String(index),
          values: { category, value },
          provenance: { sourceRowNumber: index + 2 },
        })),
      };
      const aggregation =
        kind === "count" ? { kind } : { kind, field: { fieldId: "value" } };

      expect(
        calculateChart(topNSource, {
          id: "top-values",
          kind: "bar",
          title: "Top values",
          rationale: "test",
          dimension: { fieldId: "category" },
          aggregation,
          categoryLimit: 3,
          topN: { count: 2, includeOther: true },
        }),
      ).toEqual(expected);
    },
  );
});
