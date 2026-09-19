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
    ).toEqual({ id: "total", label: "Total", value: 60, unit: "RUB" });
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
});
