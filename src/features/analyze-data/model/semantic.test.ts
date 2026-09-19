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

describe("table proposal semantics", () => {
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
