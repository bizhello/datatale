import { describe, expect, it } from "vitest";
import { finalReportSchema } from "./schema";

describe("final report contract", () => {
  const base = {
    version: 1 as const,
    hero: [{ text: "Grounded", factIds: ["f"] }],
    metrics: [{ id: "f", label: "Metric", value: 1, evidenceIds: ["e"] }],
    charts: [],
    evidence: [{ id: "e", kind: "row-range" as const, label: "All rows" }],
    recommendations: [],
  };
  it("requires an explicit reason when a report has no charts", () =>
    expect(finalReportSchema.safeParse(base).success).toBe(false));
  it("rejects a no-chart reason when charts are present", () =>
    expect(
      finalReportSchema.safeParse({
        ...base,
        noChartReason: "none",
        charts: [
          {
            id: "c",
            kind: "bar",
            title: "Chart",
            rationale: "r",
            points: [{ label: "A", value: 1 }],
            evidenceIds: ["e"],
          },
        ],
      }).success,
    ).toBe(false));
});
