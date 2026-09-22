import { describe, expect, it } from "vitest";
import type { Dataset } from "@/entities/dataset";
import { createFallbackTableProposal } from "./fallback-proposal";

const monthly: Dataset = {
  version: 1,
  id: "monthly",
  source: { kind: "csv", filename: "monthly-buckets.csv" },
  columns: [
    { id: "date", label: "Дата", scalarType: "date" },
    { id: "city", label: "Город", scalarType: "string" },
    { id: "revenue", label: "Выручка", scalarType: "number" },
    { id: "cost", label: "Себестоимость", scalarType: "number" },
    { id: "orders", label: "Заказы", scalarType: "number" },
  ],
  rows: [
    {
      id: "1",
      values: {
        date: "2026-01-02",
        city: "Москва",
        revenue: 60,
        cost: 60,
        orders: 1,
      },
      provenance: { sourceRowNumber: 2 },
    },
    {
      id: "2",
      values: {
        date: "2026-01-31",
        city: "Москва",
        revenue: 60,
        cost: 60,
        orders: 2,
      },
      provenance: { sourceRowNumber: 3 },
    },
    {
      id: "3",
      values: {
        date: "2026-02-01",
        city: "Москва",
        revenue: 100,
        cost: 100,
        orders: 3,
      },
      provenance: { sourceRowNumber: 4 },
    },
  ],
};

const knownRangeZero: Dataset = {
  version: 1,
  id: "known-range-zero",
  source: { kind: "csv", filename: "known-range-zero.csv" },
  columns: [
    { id: "date", label: "Дата", scalarType: "date" },
    { id: "city", label: "Город", scalarType: "string" },
    { id: "orders", label: "Заказы", scalarType: "number" },
  ],
  rows: [
    {
      id: "1",
      values: { date: "2026-01-01", city: "Москва", orders: 4 },
      provenance: { sourceRowNumber: 2 },
    },
    {
      id: "2",
      values: { date: "2026-01-15", city: "Москва", orders: 6 },
      provenance: { sourceRowNumber: 3 },
    },
    {
      id: "3",
      values: { date: "2026-02-01", city: "Казань", orders: 3 },
      provenance: { sourceRowNumber: 4 },
    },
  ],
};

describe("deterministic table proposal fallback", () => {
  it("returns a grounded no-chart plan for an irregular one-category series", () => {
    const proposal = createFallbackTableProposal(monthly);

    expect(proposal).toMatchObject({ outcome: "no-chart" });
    expect(proposal?.metrics).toHaveLength(3);
  });

  it("returns distinct supported charts for a small categorical table", () => {
    const proposal = createFallbackTableProposal(knownRangeZero);

    expect(proposal).toMatchObject({ outcome: "charts" });
    if (proposal?.outcome === "charts") {
      expect(proposal.charts).toHaveLength(2);
      expect(
        new Set(
          proposal.charts.map(
            (chart) =>
              `${chart.dimension.fieldId}:${chart.aggregation.kind}:${chart.aggregation.kind === "count" ? "" : chart.aggregation.field.fieldId}`,
          ),
        ).size,
      ).toBe(2);
    }
  });
});
