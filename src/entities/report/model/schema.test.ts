import { describe, expect, it } from "vitest";

import {
  analysisPlanSchema,
  BAR_MAX_CATEGORIES,
  chartCapabilityCatalog,
  chartCatalogPromptDescription,
  chartSpecificationSchema,
  DONUT_MAX_SEGMENTS,
  DONUT_MIN_SEGMENTS,
  LINE_MAX_POINTS,
  LINE_MIN_POINTS,
} from "@/entities/report";
import {
  chartedAnalysisPlanFixture,
  noChartAnalysisPlanFixture,
} from "../../../../tests/fixtures/report";

function clonePlan(): Record<string, unknown> {
  return structuredClone(chartedAnalysisPlanFixture) as Record<string, unknown>;
}

function chartsOf(
  plan: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return plan.charts as Array<Record<string, unknown>>;
}

function itemAt<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected an item at index ${index}.`);
  }
  return item;
}

function chartForKind(kind: string): Record<string, unknown> {
  const chart = chartsOf(clonePlan()).find(
    (candidate) => candidate.kind === kind,
  );
  if (chart === undefined) {
    throw new Error(`Expected a fixture chart for ${kind}.`);
  }
  return chart;
}

function aggregationFor(kind: string): Record<string, unknown> {
  return kind === "count" ? { kind } : { kind, field: { fieldId: "metric" } };
}

describe("analysisPlanSchema", () => {
  it("accepts a 2-3 chart plan with count and numeric aggregations", () => {
    const result = analysisPlanSchema.safeParse(chartedAnalysisPlanFixture);

    expect(result.success).toBe(true);
    if (result.success && result.data.outcome === "charts") {
      expect(result.data.charts).toHaveLength(3);
      expect(result.data.charts[0]?.aggregation).toEqual({
        kind: "sum",
        field: { fieldId: "revenue" },
      });
      expect(result.data.charts[1]?.aggregation).toEqual({ kind: "count" });
    }
  });

  it("accepts an explicit no-chart outcome with a useful reason", () => {
    const result = analysisPlanSchema.safeParse(noChartAnalysisPlanFixture);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(noChartAnalysisPlanFixture);
    }
  });

  it("rejects unknown chart keys and kinds, supplied series, and blank or missing references", () => {
    const unknownKey = clonePlan();
    itemAt(chartsOf(unknownKey), 0).unexpected = true;

    const unknownKind = clonePlan();
    itemAt(chartsOf(unknownKind), 0).kind = "scatter";

    const suppliedSeries = clonePlan();
    itemAt(chartsOf(suppliedSeries), 0).series = [{ x: "North", y: 10 }];

    const blankId = clonePlan();
    itemAt(chartsOf(blankId), 0).id = " \t";

    const blankTitle = clonePlan();
    itemAt(chartsOf(blankTitle), 0).title = "";

    const blankFieldReference = clonePlan();
    itemAt(chartsOf(blankFieldReference), 0).dimension = { fieldId: " " };

    const missingDimension = clonePlan();
    delete itemAt(chartsOf(missingDimension), 0).dimension;

    const blankReason = { outcome: "no-chart", reason: "\n" };

    expect(analysisPlanSchema.safeParse(unknownKey).success).toBe(false);
    expect(analysisPlanSchema.safeParse(unknownKind).success).toBe(false);
    expect(analysisPlanSchema.safeParse(suppliedSeries).success).toBe(false);
    expect(analysisPlanSchema.safeParse(blankId).success).toBe(false);
    expect(analysisPlanSchema.safeParse(blankTitle).success).toBe(false);
    expect(analysisPlanSchema.safeParse(blankFieldReference).success).toBe(
      false,
    );
    expect(analysisPlanSchema.safeParse(missingDimension).success).toBe(false);
    expect(analysisPlanSchema.safeParse(blankReason).success).toBe(false);
  });

  it("rejects duplicate chart IDs and invalid chart counts", () => {
    const duplicateIds = clonePlan();
    itemAt(chartsOf(duplicateIds), 1).id = "revenue-by-region";

    const tooFewCharts = clonePlan();
    tooFewCharts.charts = [itemAt(chartsOf(tooFewCharts), 0)];

    const tooManyCharts = clonePlan();
    const tooManyChartList = chartsOf(tooManyCharts);
    tooManyChartList.push({ ...itemAt(tooManyChartList, 0), id: "fourth" });

    expect(analysisPlanSchema.safeParse(duplicateIds).success).toBe(false);
    expect(analysisPlanSchema.safeParse(tooFewCharts).success).toBe(false);
    expect(analysisPlanSchema.safeParse(tooManyCharts).success).toBe(false);
  });

  it("rejects incompatible aggregation shapes", () => {
    const countWithField = clonePlan();
    itemAt(chartsOf(countWithField), 1).aggregation = {
      kind: "count",
      field: { fieldId: "orders" },
    };

    const numericWithoutField = clonePlan();
    itemAt(chartsOf(numericWithoutField), 0).aggregation = { kind: "sum" };

    const donutCount = clonePlan();
    itemAt(chartsOf(donutCount), 2).aggregation = { kind: "count" };

    expect(analysisPlanSchema.safeParse(countWithField).success).toBe(false);
    expect(analysisPlanSchema.safeParse(numericWithoutField).success).toBe(
      false,
    );
    expect(analysisPlanSchema.safeParse(donutCount).success).toBe(false);
  });

  it("enforces independently declared chart limits", () => {
    const barAtMaximum = clonePlan();
    itemAt(chartsOf(barAtMaximum), 0).categoryLimit = BAR_MAX_CATEGORIES;

    const lineAtBounds = clonePlan();
    itemAt(chartsOf(lineAtBounds), 1).pointLimit = LINE_MIN_POINTS;

    const donutAtBounds = clonePlan();
    itemAt(chartsOf(donutAtBounds), 2).segmentLimit = DONUT_MAX_SEGMENTS;

    const tooManyCategories = clonePlan();
    itemAt(chartsOf(tooManyCategories), 0).categoryLimit =
      BAR_MAX_CATEGORIES + 1;

    const tooFewLinePoints = clonePlan();
    itemAt(chartsOf(tooFewLinePoints), 1).pointLimit = LINE_MIN_POINTS - 1;

    const tooManyLinePoints = clonePlan();
    itemAt(chartsOf(tooManyLinePoints), 1).pointLimit = LINE_MAX_POINTS + 1;

    const tooFewDonutSegments = clonePlan();
    itemAt(chartsOf(tooFewDonutSegments), 2).segmentLimit =
      DONUT_MIN_SEGMENTS - 1;

    expect(analysisPlanSchema.safeParse(barAtMaximum).success).toBe(true);
    expect(analysisPlanSchema.safeParse(lineAtBounds).success).toBe(true);
    expect(analysisPlanSchema.safeParse(donutAtBounds).success).toBe(true);
    expect(analysisPlanSchema.safeParse(tooManyCategories).success).toBe(false);
    expect(analysisPlanSchema.safeParse(tooFewLinePoints).success).toBe(false);
    expect(analysisPlanSchema.safeParse(tooManyLinePoints).success).toBe(false);
    expect(analysisPlanSchema.safeParse(tooFewDonutSegments).success).toBe(
      false,
    );
  });
});

describe("chartCapabilityCatalog", () => {
  it("covers each allowlisted kind with independent limits and JSON-safe metadata", () => {
    expect(chartCapabilityCatalog.map((capability) => capability.kind)).toEqual(
      ["bar", "line", "donut"],
    );
    expect(
      chartCapabilityCatalog.map((capability) => capability.limits),
    ).toEqual([
      { minItems: 2, maxItems: 12 },
      { minItems: 2, maxItems: 24 },
      { minItems: 2, maxItems: 6 },
    ]);
    expect(JSON.parse(JSON.stringify(chartCapabilityCatalog))).toEqual(
      chartCapabilityCatalog,
    );
  });

  it("derives prompt text from every catalog capability", () => {
    for (const capability of chartCapabilityCatalog) {
      expect(chartCatalogPromptDescription).toContain(
        `${capability.kind}: ${capability.purpose}`,
      );
      expect(chartCatalogPromptDescription).toContain(
        capability.allowedAggregations.join(", "),
      );
      expect(chartCatalogPromptDescription).toContain(
        `${capability.limits.minItems}-${capability.limits.maxItems}`,
      );
    }
  });

  it("accepts exactly the catalog's aggregations for every chart kind", () => {
    const aggregationKinds = ["count", "sum", "average", "min", "max"];

    for (const capability of chartCapabilityCatalog) {
      for (const aggregationKind of capability.allowedAggregations) {
        const chart = chartForKind(capability.kind);
        chart.aggregation = aggregationFor(aggregationKind);

        expect(chartSpecificationSchema.safeParse(chart).success).toBe(true);
      }

      for (const aggregationKind of aggregationKinds) {
        if (
          capability.allowedAggregations.some(
            (allowedAggregation) => allowedAggregation === aggregationKind,
          )
        ) {
          continue;
        }

        const chart = chartForKind(capability.kind);
        chart.aggregation = aggregationFor(aggregationKind);

        expect(chartSpecificationSchema.safeParse(chart).success).toBe(false);
      }

      const chart = chartForKind(capability.kind);
      chart.aggregation = aggregationFor("median");

      expect(chartSpecificationSchema.safeParse(chart).success).toBe(false);
    }
  });
});
