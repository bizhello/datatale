import { z } from "zod";

import {
  BAR_CHART_KIND,
  BAR_MAX_CATEGORIES,
  COUNT_AGGREGATION_KIND,
  DONUT_ALLOWED_AGGREGATIONS,
  DONUT_CHART_KIND,
  DONUT_MAX_SEGMENTS,
  DONUT_MIN_SEGMENTS,
  LINE_CHART_KIND,
  LINE_MAX_POINTS,
  LINE_MIN_POINTS,
  NUMERIC_AGGREGATION_KINDS,
} from "./chart-catalog";

const nonblankString = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "Value must contain a non-whitespace character.",
  });

export const fieldReferenceSchema = z
  .object({
    fieldId: nonblankString,
  })
  .strict();

export const countAggregationSchema = z
  .object({
    kind: z.literal(COUNT_AGGREGATION_KIND),
  })
  .strict();

export const numericAggregationSchema = z
  .object({
    kind: z.enum(NUMERIC_AGGREGATION_KINDS),
    field: fieldReferenceSchema,
  })
  .strict();

export const aggregationSchema = z.discriminatedUnion("kind", [
  countAggregationSchema,
  numericAggregationSchema,
]);

const chartBaseSchema = z
  .object({
    id: nonblankString,
    title: nonblankString,
    rationale: nonblankString,
  })
  .strict();

export const barChartSpecificationSchema = chartBaseSchema.extend({
  kind: z.literal(BAR_CHART_KIND),
  dimension: fieldReferenceSchema,
  aggregation: aggregationSchema,
  categoryLimit: z.number().int().min(1).max(BAR_MAX_CATEGORIES),
});

export const lineChartSpecificationSchema = chartBaseSchema.extend({
  kind: z.literal(LINE_CHART_KIND),
  dimension: fieldReferenceSchema,
  aggregation: aggregationSchema,
  pointLimit: z.number().int().min(LINE_MIN_POINTS).max(LINE_MAX_POINTS),
});

export const donutChartSpecificationSchema = chartBaseSchema.extend({
  kind: z.literal(DONUT_CHART_KIND),
  dimension: fieldReferenceSchema,
  aggregation: z
    .object({
      kind: z.literal(DONUT_ALLOWED_AGGREGATIONS[0]),
      field: fieldReferenceSchema,
    })
    .strict(),
  segmentLimit: z
    .number()
    .int()
    .min(DONUT_MIN_SEGMENTS)
    .max(DONUT_MAX_SEGMENTS),
});

export const chartSpecificationSchema = z.discriminatedUnion("kind", [
  barChartSpecificationSchema,
  lineChartSpecificationSchema,
  donutChartSpecificationSchema,
]);

const chartedAnalysisPlanSchema = z
  .object({
    outcome: z.literal("charts"),
    charts: z.array(chartSpecificationSchema).min(2).max(3),
  })
  .strict()
  .superRefine((plan, context) => {
    const chartIds = new Set<string>();
    for (const [index, chart] of plan.charts.entries()) {
      if (chartIds.has(chart.id)) {
        context.addIssue({
          code: "custom",
          message: "Chart IDs must be unique within an analysis plan.",
          path: ["charts", index, "id"],
        });
      }
      chartIds.add(chart.id);
    }
  });

const noChartAnalysisPlanSchema = z
  .object({
    outcome: z.literal("no-chart"),
    reason: nonblankString,
  })
  .strict();

export const analysisPlanSchema = z.discriminatedUnion("outcome", [
  chartedAnalysisPlanSchema,
  noChartAnalysisPlanSchema,
]);

export const metricSpecificationSchema = z
  .object({
    id: nonblankString,
    label: nonblankString,
    aggregation: aggregationSchema,
  })
  .strict();

export const analysisProposalSchema = z
  .object({
    outcome: z.enum(["charts", "no-chart"]),
    charts: z.array(chartSpecificationSchema).max(3).default([]),
    metrics: z.array(metricSpecificationSchema).min(2).max(4),
    reason: nonblankString.optional(),
  })
  .strict()
  .superRefine((proposal, context) => {
    if (
      proposal.outcome === "charts" &&
      (proposal.charts.length < 2 || proposal.charts.length > 3)
    )
      context.addIssue({
        code: "custom",
        message: "Chart proposals require two or three charts.",
        path: ["charts"],
      });
    if (proposal.outcome === "no-chart" && proposal.charts.length > 0)
      context.addIssue({
        code: "custom",
        message: "No-chart proposals cannot include charts.",
        path: ["charts"],
      });
    const ids = new Set<string>();
    for (const [index, item] of [
      ...proposal.metrics,
      ...proposal.charts,
    ].entries()) {
      if (ids.has(item.id))
        context.addIssue({
          code: "custom",
          message: "Metric and chart IDs must be unique.",
          path: [index],
        });
      ids.add(item.id);
    }
  });

export const reportEvidenceSchema = z
  .object({
    id: nonblankString,
    kind: z.enum(["row-range", "quote"]),
    label: nonblankString,
    excerpt: nonblankString.optional(),
  })
  .strict();

export const reportFactSchema = z
  .object({
    id: nonblankString,
    label: nonblankString,
    value: z.number().finite(),
    unit: z.string().optional(),
    evidenceIds: z.array(nonblankString).min(1),
  })
  .strict();

export const reportChartSchema = z
  .object({
    id: nonblankString,
    kind: z.enum([BAR_CHART_KIND, LINE_CHART_KIND, DONUT_CHART_KIND]),
    title: nonblankString,
    rationale: nonblankString,
    unit: z.string().optional(),
    points: z
      .array(
        z
          .object({ label: nonblankString, value: z.number().finite() })
          .strict(),
      )
      .min(1),
    evidenceIds: z.array(nonblankString).min(1),
  })
  .strict();

export const reportNarrativeItemSchema = z
  .object({
    text: nonblankString,
    factIds: z.array(nonblankString).default([]),
    evidenceIds: z.array(nonblankString).default([]),
  })
  .strict()
  .refine(
    (item) => item.factIds.length + item.evidenceIds.length > 0,
    "Narrative must be grounded.",
  );

export const finalReportSchema = z
  .object({
    version: z.literal(1),
    hero: z.array(reportNarrativeItemSchema).min(1).max(3),
    metrics: z.array(reportFactSchema).min(1).max(4),
    charts: z.array(reportChartSchema).max(3),
    evidence: z.array(reportEvidenceSchema).min(1),
    recommendations: z.array(reportNarrativeItemSchema).max(3),
    noChartReason: nonblankString.optional(),
  })
  .strict()
  .superRefine((report, context) => {
    if (report.charts.length === 0 && !report.noChartReason)
      context.addIssue({
        code: "custom",
        message: "No-chart reports require a reason.",
        path: ["noChartReason"],
      });
    if (report.charts.length > 0 && report.noChartReason)
      context.addIssue({
        code: "custom",
        message: "Charted reports cannot have a no-chart reason.",
        path: ["noChartReason"],
      });
  });

export type FieldReference = z.infer<typeof fieldReferenceSchema>;
export type CountAggregation = z.infer<typeof countAggregationSchema>;
export type NumericAggregation = z.infer<typeof numericAggregationSchema>;
export type Aggregation = z.infer<typeof aggregationSchema>;
export type BarChartSpecification = z.infer<typeof barChartSpecificationSchema>;
export type LineChartSpecification = z.infer<
  typeof lineChartSpecificationSchema
>;
export type DonutChartSpecification = z.infer<
  typeof donutChartSpecificationSchema
>;
export type ChartSpecification = z.infer<typeof chartSpecificationSchema>;
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export type MetricSpecification = z.infer<typeof metricSpecificationSchema>;
export type AnalysisProposal = z.infer<typeof analysisProposalSchema>;
export type FinalReport = z.infer<typeof finalReportSchema>;
