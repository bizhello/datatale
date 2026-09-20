import { describe, expect, it } from "vitest";
import type { Dataset } from "@/entities/dataset";
import { syntheticDatasetFixture } from "../../../../tests/fixtures/dataset";
import { chartedAnalysisPlanFixture } from "../../../../tests/fixtures/report";
import { SemanticValidationError, validateTableProposal } from "./semantic";

const completeDonutSource = (): Dataset => ({
  version: 1 as const,
  id: "donut-source",
  source: { kind: "csv" as const },
  columns: [
    { id: "segment", label: "Segment", scalarType: "string" as const },
    { id: "amount", label: "Amount", scalarType: "number" as const },
  ],
  rows: [
    {
      id: "1",
      values: { segment: "A", amount: 20 },
      provenance: { sourceRowNumber: 2 },
    },
    {
      id: "2",
      values: { segment: "B", amount: 10 },
      provenance: { sourceRowNumber: 3 },
    },
  ],
});

const donutProposal = () => ({
  outcome: "charts" as const,
  metrics: [
    { id: "amount", label: "Amount", aggregation: { kind: "count" as const } },
  ],
  charts: [
    {
      id: "share",
      kind: "donut" as const,
      title: "Share",
      rationale: "test",
      dimension: { fieldId: "segment" },
      aggregation: { kind: "sum" as const, field: { fieldId: "amount" } },
      segmentLimit: 2,
    },
  ],
});

const noChartProposal = (fieldId: string) => ({
  outcome: "no-chart" as const,
  reason: "No supported relationships.",
  metrics: [
    {
      id: "total",
      label: "Total",
      aggregation: { kind: "sum" as const, field: { fieldId } },
    },
    {
      id: "average",
      label: "Average",
      aggregation: { kind: "average" as const, field: { fieldId } },
    },
  ],
});

describe("table proposal semantics", () => {
  it("rejects no-chart for the demo shape with two numeric category stories", () => {
    const source: Dataset = {
      version: 1,
      id: "demo",
      source: { kind: "csv", filename: "demo.csv" },
      columns: [
        { id: "month", label: "Месяц", scalarType: "string" },
        { id: "revenue", label: "Выручка", scalarType: "number" },
        { id: "orders", label: "Заказы", scalarType: "number" },
      ],
      rows: [
        {
          id: "1",
          values: { month: "Январь", revenue: 128000, orders: 120 },
          provenance: { sourceRowNumber: 2 },
        },
        {
          id: "2",
          values: { month: "Февраль", revenue: 146000, orders: 132 },
          provenance: { sourceRowNumber: 3 },
        },
      ],
    };
    const invalid = {
      outcome: "no-chart" as const,
      reason: "No supported relationships.",
      metrics: [
        {
          id: "revenue",
          label: "Revenue",
          aggregation: {
            kind: "sum" as const,
            field: { fieldId: "revenue" },
          },
        },
        {
          id: "orders",
          label: "Orders",
          aggregation: {
            kind: "sum" as const,
            field: { fieldId: "orders" },
          },
        },
      ],
    };

    expect(() => validateTableProposal(source, invalid)).toThrow(
      /at least two distinct chart stories accepted by the trusted catalog/,
    );
  });

  it("counts valid count charts as distinct stories", () => {
    const source: Dataset = {
      version: 1,
      id: "categories",
      source: { kind: "csv" },
      columns: [
        { id: "region", label: "Region", scalarType: "string" },
        { id: "channel", label: "Channel", scalarType: "string" },
      ],
      rows: [
        {
          id: "1",
          values: { region: "North", channel: "Online" },
          provenance: { sourceRowNumber: 2 },
        },
        {
          id: "2",
          values: { region: "South", channel: "Retail" },
          provenance: { sourceRowNumber: 3 },
        },
      ],
    };
    const invalid = {
      outcome: "no-chart" as const,
      reason: "No supported relationships.",
      metrics: [
        { id: "rows", label: "Rows", aggregation: { kind: "count" as const } },
        {
          id: "records",
          label: "Records",
          aggregation: { kind: "count" as const },
        },
      ],
    };

    expect(() => validateTableProposal(source, invalid)).toThrow(
      /at least two distinct chart stories/,
    );
  });

  it("accepts no-chart when fewer than two chart stories are supported", () => {
    const source: Dataset = {
      version: 1,
      id: "measure-only",
      source: { kind: "csv" },
      columns: [{ id: "amount", label: "Amount", scalarType: "number" }],
      rows: [
        {
          id: "1",
          values: { amount: 20 },
          provenance: { sourceRowNumber: 2 },
        },
        {
          id: "2",
          values: { amount: 10 },
          provenance: { sourceRowNumber: 3 },
        },
      ],
    };
    expect(() =>
      validateTableProposal(source, noChartProposal("amount")),
    ).not.toThrow();
  });

  it("rejects a line that would connect missing periods", () => {
    const source = structuredClone(syntheticDatasetFixture);
    source.columns = [
      { id: "month", label: "Month", scalarType: "date" },
      { id: "revenue", label: "Revenue", scalarType: "number" },
      { id: "region", label: "Region", scalarType: "string" },
      { id: "channel", label: "Channel", scalarType: "string" },
    ];
    source.rows = [
      {
        id: "1",
        values: { month: "2026-01-01", revenue: 1, region: "A", channel: "A" },
        provenance: { sourceRowNumber: 2 },
      },
      {
        id: "2",
        values: { month: "2026-03-01", revenue: 1, region: "B", channel: "B" },
        provenance: { sourceRowNumber: 3 },
      },
      {
        id: "3",
        values: { month: "2026-04-01", revenue: 1, region: "A", channel: "A" },
        provenance: { sourceRowNumber: 4 },
      },
    ];
    expect(() =>
      validateTableProposal(source, chartedAnalysisPlanFixture),
    ).toThrow(SemanticValidationError);
  });

  it("accepts a donut whose additive total covers every row", () => {
    expect(() =>
      validateTableProposal(completeDonutSource(), donutProposal()),
    ).not.toThrow();
  });

  it.each([
    ["dimension", { segment: null, amount: 10 }, /missing dimension/],
    ["measure", { segment: "B", amount: null }, /missing measure/],
  ] as const)(
    "rejects a donut with a missing %s row value",
    (_missingField, values, expectedIssue) => {
      const source = completeDonutSource();
      source.rows[1] = {
        id: "2",
        values,
        provenance: { sourceRowNumber: 3 },
      };

      expect(() => validateTableProposal(source, donutProposal())).toThrow(
        expectedIssue,
      );
    },
  );
});
