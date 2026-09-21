import { z } from "zod";

export const DATASET_QUERY_MAX_FILTERS = 20;
export const DATASET_QUERY_MAX_SELECT_FIELDS = 30;
export const DATASET_QUERY_MAX_METRICS = 20;
export const DATASET_QUERY_MAX_ORDER_FIELDS = 20;
export const DATASET_QUERY_MAX_LIMIT = 1_000;
export const DATASET_QUERY_MAX_GROUPS = 1_000;

const id = z
  .string()
  .min(1)
  .max(160)
  .refine((value) => value.trim().length > 0);
const fieldReference = z.object({ fieldId: id }).strict();
const groupedFieldReference = z
  .object({
    fieldId: id,
    dateBucket: z.enum(["day", "month", "quarter", "year"]).optional(),
  })
  .strict();
const selectFieldReference = z.union([id, fieldReference]);

export const datasetFilterOperatorSchema = z.enum([
  "eq",
  "ne",
  "in",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
]);
export const datasetQueryFilterSchema = z
  .object({
    fieldId: id,
    operator: datasetFilterOperatorSchema,
    value: z.union([
      z.string(),
      z.number().finite(),
      z.boolean(),
      z.null(),
      z
        .array(
          z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
        )
        .min(1)
        .max(100),
    ]),
  })
  .strict();
export const datasetQueryMetricSchema = z
  .object({
    id,
    aggregation: z.enum([
      "count",
      "sum",
      "average",
      "min",
      "max",
      "distinctCount",
    ]),
    fieldId: id.optional(),
  })
  .strict();
export const datasetQueryOrderSchema = z
  .object({
    fieldId: id.optional(),
    metricId: id.optional(),
    direction: z.enum(["asc", "desc"]),
  })
  .strict()
  .refine(
    (value) => (value.fieldId === undefined) !== (value.metricId === undefined),
    {
      message: "Order must reference exactly one field or metric.",
    },
  );

export const datasetQuerySchema = z
  .object({
    queryId: id,
    purpose: z.enum(["lookup", "count"]).default("count"),
    filters: z
      .array(datasetQueryFilterSchema)
      .max(DATASET_QUERY_MAX_FILTERS)
      .default([]),
    groupBy: z.union([id, groupedFieldReference]).optional(),
    select: z
      .array(selectFieldReference)
      .max(DATASET_QUERY_MAX_SELECT_FIELDS)
      .default([]),
    metrics: z
      .array(datasetQueryMetricSchema)
      .max(DATASET_QUERY_MAX_METRICS)
      .default([]),
    orderBy: z
      .array(datasetQueryOrderSchema)
      .max(DATASET_QUERY_MAX_ORDER_FIELDS)
      .default([]),
    limit: z
      .number()
      .int()
      .min(1)
      .max(DATASET_QUERY_MAX_LIMIT)
      .default(DATASET_QUERY_MAX_LIMIT),
  })
  .strict()
  .superRefine((query, context) => {
    const ids = new Set<string>();
    for (const [index, metric] of query.metrics.entries()) {
      if (ids.has(metric.id))
        context.addIssue({
          code: "custom",
          message: "Metric IDs must be unique.",
          path: ["metrics", index, "id"],
        });
      ids.add(metric.id);
    }
    const fields = new Set(
      query.select.map((field) =>
        typeof field === "string" ? field : field.fieldId,
      ),
    );
    if (fields.size !== query.select.length)
      context.addIssue({
        code: "custom",
        message: "Selected fields must be unique.",
        path: ["select"],
      });
  });

export type DatasetQuery = z.input<typeof datasetQuerySchema>;
export type NormalizedDatasetQuery = z.output<typeof datasetQuerySchema>;
export type DatasetQueryFilter = z.infer<typeof datasetQueryFilterSchema>;
export type DatasetQueryMetric = z.infer<typeof datasetQueryMetricSchema>;
export type DatasetQueryPurpose = NormalizedDatasetQuery["purpose"];

export const datasetQueryRowReferenceSchema = z
  .object({
    rowId: id,
    sourceRowNumber: z.number().int().positive(),
  })
  .strict();
export const datasetQueryResultSchema = z
  .object({
    queryId: id,
    rows: z.array(
      z.record(
        z.string(),
        z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
      ),
    ),
    groups: z.array(
      z
        .object({
          key: z.union([
            z.string(),
            z.number().finite(),
            z.boolean(),
            z.null(),
          ]),
          metrics: z.record(z.string(), z.number().finite().nullable()),
          rowReferences: z.array(datasetQueryRowReferenceSchema),
        })
        .strict(),
    ),
    metrics: z.record(z.string(), z.number().finite().nullable()),
    matchedRows: z.number().int().nonnegative(),
    scannedRows: z.number().int().nonnegative(),
    returnedRows: z.number().int().nonnegative(),
    truncated: z.boolean(),
    rowReferences: z.array(datasetQueryRowReferenceSchema),
  })
  .strict();
export type DatasetQueryResult = z.infer<typeof datasetQueryResultSchema>;
