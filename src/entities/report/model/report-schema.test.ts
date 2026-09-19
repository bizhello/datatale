import { describe, expect, it } from "vitest";
import {
  finalReportSchema,
  REPORT_NARRATIVE_MAX_LENGTH,
  REPORT_QUOTE_MAX_LENGTH,
  textExtractionResponseSchema,
} from "./schema";

describe("final report contract", () => {
  const base = {
    version: 1 as const,
    hero: [
      { text: "Grounded.", factIds: ["f"] },
      { text: "Confirmed.", factIds: ["f"] },
    ],
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
  it("bounds model-controlled text fields and requires text-fact context", () => {
    expect(
      textExtractionResponseSchema.safeParse({
        facts: [
          {
            id: "fact",
            label: "Metric",
            value: 1,
            unit: "unit",
            period: "January",
            paragraphIndex: 1,
            quote: "x".repeat(REPORT_QUOTE_MAX_LENGTH + 1),
          },
        ],
        observations: [],
      }).success,
    ).toBe(false);
    expect(
      textExtractionResponseSchema.safeParse({
        facts: [
          {
            id: "fact",
            label: "Metric",
            value: 1,
            unit: "unit",
            paragraphIndex: 1,
            quote: "1 unit in January",
          },
        ],
        observations: [],
      }).success,
    ).toBe(false);
    expect(
      finalReportSchema.safeParse({
        ...base,
        noChartReason: "No visual relationship is supported.",
        hero: [
          {
            text: "x".repeat(REPORT_NARRATIVE_MAX_LENGTH + 1),
            factIds: ["f"],
          },
          { text: "Confirmed.", factIds: ["f"] },
        ],
      }).success,
    ).toBe(false);
  });
  it("rejects reports whose UTF-8 serialized form exceeds the storage budget", () => {
    const long = "я".repeat(REPORT_QUOTE_MAX_LENGTH);
    const report = {
      version: 1 as const,
      hero: Array.from({ length: 3 }, (_, index) => ({
        text: `Observation ${index}: ${"я".repeat(480)}`,
        factIds: [`f${index}`],
      })),
      metrics: Array.from({ length: 4 }, (_, index) => ({
        id: `f${index}`,
        label: `Metric ${index}`,
        value: index,
        evidenceIds: [`e${index}`],
      })),
      charts: Array.from({ length: 3 }, (_, chartIndex) => ({
        id: `c${chartIndex}`,
        kind: "line" as const,
        title: `Chart ${chartIndex}`,
        rationale: "я".repeat(300),
        points: Array.from({ length: 24 }, (_, pointIndex) => ({
          label: `Point ${pointIndex}: ${"я".repeat(100)}`,
          value: pointIndex,
        })),
        evidenceIds: ["e0"],
      })),
      evidence: Array.from({ length: 7 }, (_, index) => ({
        id: `e${index}`,
        kind: "quote" as const,
        label: `Paragraph ${index}`,
        excerpt: long,
      })),
      recommendations: Array.from({ length: 3 }, (_, index) => ({
        text: `Action ${index}: ${"я".repeat(480)}`,
        factIds: [`f${index}`],
        kind: "action" as const,
      })),
    };

    expect(finalReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects one-item hero payloads at the canonical boundary", () => {
    expect(
      finalReportSchema.safeParse({
        ...base,
        hero: [{ text: "Only one.", factIds: ["f"] }],
        noChartReason: "No visual relationship is supported.",
      }).success,
    ).toBe(false);
  });
});
