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

export const REPORT_ID_MAX_LENGTH = 80;
export const FIELD_REFERENCE_MAX_LENGTH = 160;
export const REPORT_LABEL_MAX_LENGTH = 120;
export const REPORT_TITLE_MAX_LENGTH = 120;
export const REPORT_RATIONALE_MAX_LENGTH = 320;
export const REPORT_NARRATIVE_MAX_LENGTH = 500;
export const REPORT_UNIT_MAX_LENGTH = 64;
export const REPORT_PERIOD_MAX_LENGTH = 96;
export const REPORT_QUOTE_MAX_LENGTH = 1_000;
export const REPORT_NO_CHART_REASON_MAX_LENGTH = 300;
export const REPORT_MAX_SERIALIZED_BYTES = 24 * 1_024;
export const REPORT_MAX_EVIDENCE = 8;
export const REPORT_MAX_TEXT_OBSERVATIONS = 8;
export const REPORT_MAX_TEXT_CHART_GROUPS = 3;

const boundedNonblankString = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0, {
      message: "Value must contain a non-whitespace character.",
    });
const identifierString = boundedNonblankString(REPORT_ID_MAX_LENGTH);
const fieldReferenceString = boundedNonblankString(FIELD_REFERENCE_MAX_LENGTH);
const labelString = boundedNonblankString(REPORT_LABEL_MAX_LENGTH);
const titleString = boundedNonblankString(REPORT_TITLE_MAX_LENGTH);
const rationaleString = boundedNonblankString(REPORT_RATIONALE_MAX_LENGTH);
const narrativeString = boundedNonblankString(REPORT_NARRATIVE_MAX_LENGTH);
const unitString = boundedNonblankString(REPORT_UNIT_MAX_LENGTH);
const periodString = boundedNonblankString(REPORT_PERIOD_MAX_LENGTH);
const quoteString = boundedNonblankString(REPORT_QUOTE_MAX_LENGTH);
const noChartReasonString = boundedNonblankString(
  REPORT_NO_CHART_REASON_MAX_LENGTH,
);
const idsAreUnique = (
  items: Array<{ id: string }>,
  context: z.RefinementCtx,
  path: string,
) => {
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.id))
      context.addIssue({
        code: "custom",
        message: "IDs must be unique.",
        path: [path, index, "id"],
      });
    ids.add(item.id);
  }
};

export const fieldReferenceSchema = z
  .object({ fieldId: fieldReferenceString })
  .strict();
export const countAggregationSchema = z
  .object({ kind: z.literal(COUNT_AGGREGATION_KIND) })
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
    id: identifierString,
    title: titleString,
    rationale: rationaleString,
  })
  .strict();
const topNSchema = z
  .object({
    count: z
      .number()
      .int()
      .min(1)
      .max(BAR_MAX_CATEGORIES - 1),
    includeOther: z.literal(true),
  })
  .strict();
export const barChartSpecificationSchema = chartBaseSchema.extend({
  kind: z.literal(BAR_CHART_KIND),
  dimension: fieldReferenceSchema,
  aggregation: aggregationSchema,
  categoryLimit: z.number().int().min(1).max(BAR_MAX_CATEGORIES),
  topN: topNSchema.optional(),
});
export const lineChartSpecificationSchema = chartBaseSchema.extend({
  kind: z.literal(LINE_CHART_KIND),
  dimension: fieldReferenceSchema,
  aggregation: aggregationSchema,
  pointLimit: z.number().int().min(LINE_MIN_POINTS).max(LINE_MAX_POINTS),
  missingPeriodPolicy: z.literal("reject"),
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
export const metricSpecificationSchema = z
  .object({
    id: identifierString,
    label: labelString,
    aggregation: aggregationSchema,
  })
  .strict();

const chartedAnalysisProposalSchema = z
  .object({
    outcome: z.literal("charts"),
    charts: z.array(chartSpecificationSchema).min(2).max(3),
    metrics: z.array(metricSpecificationSchema).min(2).max(4),
  })
  .strict()
  .superRefine((proposal, context) => {
    idsAreUnique(proposal.charts, context, "charts");
    idsAreUnique(proposal.metrics, context, "metrics");
    const ids = new Set(proposal.charts.map((chart) => chart.id));
    for (const [index, metric] of proposal.metrics.entries())
      if (ids.has(metric.id))
        context.addIssue({
          code: "custom",
          message: "Metric and chart IDs must be unique.",
          path: ["metrics", index, "id"],
        });
  });
const noChartAnalysisProposalSchema = z
  .object({
    outcome: z.literal("no-chart"),
    reason: noChartReasonString,
    metrics: z.array(metricSpecificationSchema).min(2).max(4),
  })
  .strict()
  .superRefine((proposal, context) =>
    idsAreUnique(proposal.metrics, context, "metrics"),
  );
export const analysisProposalSchema = z.discriminatedUnion("outcome", [
  chartedAnalysisProposalSchema,
  noChartAnalysisProposalSchema,
]);
export const analysisPlanSchema = analysisProposalSchema;

export const reportEvidenceSchema = z
  .object({
    id: identifierString,
    kind: z.enum(["row-range", "quote"]),
    label: labelString,
    excerpt: quoteString.optional(),
    coverage: z
      .object({
        included: z.number().int().nonnegative(),
        total: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();
const reportNumericCalculationSchema = z
  .object({
    kind: z.enum(["sum", "average", "min", "max"]),
    fieldId: fieldReferenceString,
    fieldLabel: labelString,
  })
  .strict();
const reportCountCalculationSchema = z
  .object({ kind: z.literal("count") })
  .strict();
const reportDirectSourceCalculationSchema = z
  .object({ kind: z.literal("direct-source") })
  .strict();
export const reportCalculationSchema = z.discriminatedUnion("kind", [
  reportCountCalculationSchema,
  reportNumericCalculationSchema,
  reportDirectSourceCalculationSchema,
]);
const reportChartCountCalculationSchema = z
  .object({
    kind: z.literal("count"),
    dimensionFieldId: fieldReferenceString,
    dimensionLabel: labelString,
  })
  .strict();
const reportChartNumericCalculationSchema = z
  .object({
    kind: z.enum(["sum", "average", "min", "max"]),
    fieldId: fieldReferenceString,
    fieldLabel: labelString,
    dimensionFieldId: fieldReferenceString,
    dimensionLabel: labelString,
  })
  .strict();
export const reportChartCalculationSchema = z.discriminatedUnion("kind", [
  reportChartCountCalculationSchema,
  reportChartNumericCalculationSchema,
]);
export const reportFactSchema = z
  .object({
    id: identifierString,
    label: labelString,
    value: z.number().finite(),
    unit: unitString.optional(),
    calculation: reportCalculationSchema,
    evidenceIds: z.array(identifierString).min(1).max(REPORT_MAX_EVIDENCE),
  })
  .strict();
export const textObservationRoleSchema = z.enum([
  "snapshot",
  "change",
  "target",
]);
export const textObservationSchema = z
  .object({
    id: identifierString,
    subject: labelString,
    value: z.number().finite(),
    unit: unitString.nullable(),
    period: periodString.nullable(),
    role: textObservationRoleSchema,
    paragraphIndex: z.number().int().positive(),
    quote: quoteString,
  })
  .strict();
export const textChartGroupSchema = z
  .object({
    id: identifierString,
    kind: z.enum(["bar", "line"]),
    title: titleString,
    rationale: rationaleString,
    observationIds: z.array(identifierString).min(2).max(REPORT_MAX_EVIDENCE),
    derivation: z.enum(["direct", "current-target", "baseline-change"]),
    operation: z.enum(["none", "increase", "decrease"]).default("none"),
  })
  .strict()
  .superRefine((group, context) => {
    if (new Set(group.observationIds).size !== group.observationIds.length)
      context.addIssue({
        code: "custom",
        message: "Chart observation IDs must be unique.",
        path: ["observationIds"],
      });
  });
export const reportChartSchema = z
  .object({
    id: identifierString,
    kind: z.enum([BAR_CHART_KIND, LINE_CHART_KIND, DONUT_CHART_KIND]),
    title: titleString,
    rationale: rationaleString,
    aggregation: reportChartCalculationSchema,
    unit: unitString.optional(),
    points: z
      .array(
        z.object({ label: labelString, value: z.number().finite() }).strict(),
      )
      .min(1)
      .max(LINE_MAX_POINTS),
    evidenceIds: z.array(identifierString).min(1).max(REPORT_MAX_EVIDENCE),
    observationIds: z
      .array(identifierString)
      .min(1)
      .max(REPORT_MAX_EVIDENCE)
      .optional(),
  })
  .strict();
export const reportNarrativeItemSchema = z
  .object({
    text: narrativeString,
    factIds: z.array(identifierString).max(4).default([]),
    evidenceIds: z.array(identifierString).max(REPORT_MAX_EVIDENCE).default([]),
    kind: z
      .enum(["observation", "hypothesis", "action"])
      .default("observation"),
  })
  .strict()
  .refine(
    (item) => item.factIds.length + item.evidenceIds.length > 0,
    "Narrative must be grounded.",
  );
export const finalReportSchema = z
  .object({
    version: z.literal(1),
    hero: z.array(reportNarrativeItemSchema).min(2).max(3),
    metrics: z.array(reportFactSchema).max(4),
    observations: z
      .array(textObservationSchema)
      .max(REPORT_MAX_TEXT_OBSERVATIONS)
      .optional(),
    charts: z.array(reportChartSchema).max(3),
    evidence: z.array(reportEvidenceSchema).min(1).max(REPORT_MAX_EVIDENCE),
    recommendations: z.array(reportNarrativeItemSchema).max(3),
    noChartReason: noChartReasonString.optional(),
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
    idsAreUnique(report.evidence, context, "evidence");
    idsAreUnique(report.metrics, context, "metrics");
    idsAreUnique(report.charts, context, "charts");
    if (
      new TextEncoder().encode(JSON.stringify(report)).byteLength >
      REPORT_MAX_SERIALIZED_BYTES
    )
      context.addIssue({
        code: "custom",
        message: "Report exceeds the serialized size limit.",
      });
  });
export const narrativeResponseSchema = z
  .object({
    hero: z
      .array(
        z
          .object({
            text: narrativeString,
            factIds: z.array(identifierString).max(4),
            evidenceIds: z
              .array(identifierString)
              .max(REPORT_MAX_EVIDENCE)
              .default([]),
            kind: z
              .enum(["observation", "hypothesis", "action"])
              .default("observation"),
          })
          .strict(),
      )
      .min(2)
      .max(3),
    recommendations: z
      .array(
        z
          .object({
            text: narrativeString,
            factIds: z.array(identifierString).max(4),
            evidenceIds: z
              .array(identifierString)
              .max(REPORT_MAX_EVIDENCE)
              .default([]),
            kind: z.literal("action").default("action"),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
const textReportNarrativeItemSchema = z
  .object({
    template: z.enum(["fact", "fact-list", "qualitative", "change", "target"]),
    observationIds: z.array(identifierString).min(1).max(REPORT_MAX_EVIDENCE),
    kind: z.enum(["observation", "hypothesis", "action"]),
  })
  .strict();
const textReportRecommendationSchema = textReportNarrativeItemSchema.extend({
  kind: z.literal("action"),
});

/**
 * The single model response used for unstructured text sources. Narrative
 * references observations directly; the application resolves them to facts
 * and quote evidence only after validating the source excerpts.
 */
export const textReportResponseSchema = z
  .object({
    observations: z
      .array(
        z
          .object({
            id: identifierString,
            subject: labelString.nullable(),
            value: z.number().finite().nullable(),
            unit: unitString.nullable(),
            period: periodString.nullable(),
            role: textObservationRoleSchema.nullable(),
            paragraphIndex: z.number().int().positive(),
            quote: quoteString,
          })
          .strict(),
      )
      .max(REPORT_MAX_TEXT_OBSERVATIONS),
    chartGroups: z
      .array(textChartGroupSchema)
      .max(REPORT_MAX_TEXT_CHART_GROUPS)
      .default([]),
    hero: z.array(textReportNarrativeItemSchema).min(2).max(3),
    recommendations: z.array(textReportRecommendationSchema).max(3),
  })
  .strict()
  .superRefine((value, context) => {
    idsAreUnique(value.observations, context, "observations");
    const observationIds = new Set(value.observations.map((item) => item.id));
    for (const [section, items] of [
      ["hero", value.hero],
      ["recommendations", value.recommendations],
    ] as const) {
      for (const [index, item] of items.entries()) {
        if (item.observationIds.some((id) => !observationIds.has(id)))
          context.addIssue({
            code: "custom",
            message: "Narrative references an unknown observation.",
            path: [section, index, "observationIds"],
          });
      }
    }
    for (const [index, group] of value.chartGroups.entries()) {
      if (group.observationIds.some((id) => !observationIds.has(id)))
        context.addIssue({
          code: "custom",
          message: "Chart references an unknown observation.",
          path: ["chartGroups", index, "observationIds"],
        });
    }
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
export type ReportCalculation = z.infer<typeof reportCalculationSchema>;
export type ReportChartCalculation = z.infer<
  typeof reportChartCalculationSchema
>;
export type TextReportResponse = z.infer<typeof textReportResponseSchema>;
export type TextObservation = z.infer<typeof textObservationSchema>;
export type TextChartGroup = z.input<typeof textChartGroupSchema>;
