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
