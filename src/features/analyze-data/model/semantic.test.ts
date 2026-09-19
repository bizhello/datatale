import { describe, expect, it } from "vitest";
import { syntheticDatasetFixture } from "../../../../tests/fixtures/dataset";
import { chartedAnalysisPlanFixture } from "../../../../tests/fixtures/report";
import { SemanticValidationError, validateTableProposal } from "./semantic";

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
});
