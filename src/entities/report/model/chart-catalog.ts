export const CHART_CATALOG_VERSION = 1;
export const BAR_CHART_KIND = "bar";
export const LINE_CHART_KIND = "line";
export const DONUT_CHART_KIND = "donut";
export const COUNT_AGGREGATION_KIND = "count";
export const NUMERIC_AGGREGATION_KINDS = [
  "sum",
  "average",
  "min",
  "max",
] as const;
export const BAR_ALLOWED_AGGREGATIONS = [
  COUNT_AGGREGATION_KIND,
  ...NUMERIC_AGGREGATION_KINDS,
] as const;
export const LINE_ALLOWED_AGGREGATIONS = BAR_ALLOWED_AGGREGATIONS;
export const DONUT_ALLOWED_AGGREGATIONS = ["sum"] as const;
export const BAR_MAX_CATEGORIES = 12;
export const DONUT_MIN_SEGMENTS = 2;
export const DONUT_MAX_SEGMENTS = 6;
export const LINE_MIN_POINTS = 2;
export const LINE_MAX_POINTS = 24;

export const chartCapabilityCatalog = [
  {
    kind: BAR_CHART_KIND,
    purpose: "Compare a metric across categories.",
    requiredDimension: {
      role: "category",
      semantic: "categorical",
    },
    allowedAggregations: BAR_ALLOWED_AGGREGATIONS,
    disqualifiers: [
      "Mixed units.",
      "More categories than the selected limit without a documented top-N and Other policy.",
    ],
    limits: {
      minItems: 2,
      maxItems: BAR_MAX_CATEGORIES,
    },
    presentationRequirements: ["Use an honest baseline."],
  },
  {
    kind: LINE_CHART_KIND,
    purpose: "Show a metric over ordered time periods.",
    requiredDimension: {
      role: "time",
      semantic: "temporal",
    },
    allowedAggregations: LINE_ALLOWED_AGGREGATIONS,
    disqualifiers: [
      "Unordered or non-temporal dimension.",
      "Missing periods that would be falsely connected.",
    ],
    limits: {
      minItems: LINE_MIN_POINTS,
      maxItems: LINE_MAX_POINTS,
    },
    presentationRequirements: ["Preserve chronological order."],
  },
  {
    kind: DONUT_CHART_KIND,
    purpose: "Show non-negative additive parts of one meaningful whole.",
    requiredDimension: {
      role: "segment",
      semantic: "categorical",
    },
    allowedAggregations: DONUT_ALLOWED_AGGREGATIONS,
    disqualifiers: [
      "Negative values.",
      "A zero or incomplete total.",
      "Averages or overlapping categories.",
    ],
    limits: {
      minItems: DONUT_MIN_SEGMENTS,
      maxItems: DONUT_MAX_SEGMENTS,
    },
    presentationRequirements: ["Explain what the total represents."],
  },
] as const;

export type ChartKind = (typeof chartCapabilityCatalog)[number]["kind"];
export type ChartAggregationKind =
  (typeof chartCapabilityCatalog)[number]["allowedAggregations"][number];

function describeCapability(
  capability: (typeof chartCapabilityCatalog)[number],
): string {
  return [
    `${capability.kind}: ${capability.purpose}`,
    `Required ${capability.requiredDimension.role} dimension: ${capability.requiredDimension.semantic}.`,
    `Allowed aggregations: ${capability.allowedAggregations.join(", ")}.`,
    `Items: ${capability.limits.minItems}-${capability.limits.maxItems}.`,
    `Do not use when ${capability.disqualifiers.join(" ")}`,
    `Presentation: ${capability.presentationRequirements.join(" ")}`,
  ].join(" ");
}

export const chartCatalogPromptDescription = chartCapabilityCatalog
  .map(describeCapability)
  .join("\n");
