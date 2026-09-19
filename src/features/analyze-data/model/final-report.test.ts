import { describe, expect, it } from "vitest";
import type { FinalReport } from "@/entities/report";
import {
  FinalReportValidationError,
  validateFinalReportReferences,
} from "./final-report";

const report: FinalReport = {
  version: 1,
  hero: [
    { text: "Observed.", factIds: ["f"], evidenceIds: [], kind: "observation" },
    {
      text: "Confirmed.",
      factIds: ["f"],
      evidenceIds: [],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "f",
      label: "Fact",
      value: 2,
      calculation: { kind: "count" },
      evidenceIds: ["e"],
    },
  ],
  charts: [],
  evidence: [{ id: "e", kind: "row-range", label: "All rows" }],
  recommendations: [],
  noChartReason: "No supported chart.",
};
describe("final report references", () => {
  it("fails closed when a displayed narrative claim has no checked fact", () => {
    const invalid = structuredClone(report);
    const hero = invalid.hero[0];
    if (!hero) throw new Error("Expected hero fixture.");
    hero.factIds = ["missing"];
    expect(() => validateFinalReportReferences(invalid)).toThrow(
      FinalReportValidationError,
    );
  });
});
