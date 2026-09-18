import { z } from "zod";

export const DATASET_SCHEMA_VERSION = 1;
export const DATASET_MIN_COLUMNS = 1;
export const DATASET_MAX_COLUMNS = 30;
export const DATASET_MIN_ROWS = 1;
export const DATASET_MAX_ROWS = 5_000;

const nonemptyString = z.string().min(1);

const calendarDate = z.iso.date();

export const datasetScalarTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
]);

export const datasetColumnSchema = z
  .object({
    id: nonemptyString,
    label: nonemptyString,
    scalarType: datasetScalarTypeSchema,
    unit: nonemptyString.optional(),
  })
  .strict();

const datasetValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const datasetRowSchema = z
  .object({
    id: nonemptyString,
    values: z.record(z.string(), datasetValueSchema),
    provenance: z
      .object({
        sourceRowNumber: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export const datasetSourceSchema = z
  .object({
    kind: z.enum(["csv", "xlsx", "text"]),
    filename: nonemptyString.optional(),
    sheet: nonemptyString.optional(),
  })
  .strict();

function isValueCompatibleWithColumn(
  value: z.infer<typeof datasetValueSchema>,
  scalarType: z.infer<typeof datasetScalarTypeSchema>,
): boolean {
  if (value === null) {
    return true;
  }

  switch (scalarType) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return calendarDate.safeParse(value).success;
  }
}

export const datasetSchema = z
  .object({
    version: z.literal(DATASET_SCHEMA_VERSION),
    id: nonemptyString,
    source: datasetSourceSchema,
    columns: z
      .array(datasetColumnSchema)
      .min(DATASET_MIN_COLUMNS)
      .max(DATASET_MAX_COLUMNS),
    rows: z.array(datasetRowSchema).min(DATASET_MIN_ROWS).max(DATASET_MAX_ROWS),
  })
  .strict()
  .superRefine((dataset, context) => {
    const columnIds = new Set<string>();
    for (const [index, column] of dataset.columns.entries()) {
      if (columnIds.has(column.id)) {
        context.addIssue({
          code: "custom",
          message: "Column IDs must be unique.",
          path: ["columns", index, "id"],
        });
      }
      columnIds.add(column.id);
    }

    const rowIds = new Set<string>();
    for (const [rowIndex, row] of dataset.rows.entries()) {
      if (rowIds.has(row.id)) {
        context.addIssue({
          code: "custom",
          message: "Row IDs must be unique.",
          path: ["rows", rowIndex, "id"],
        });
      }
      rowIds.add(row.id);

      const valueKeys = new Set(Object.keys(row.values));
      for (const column of dataset.columns) {
        if (!valueKeys.has(column.id)) {
          context.addIssue({
            code: "custom",
            message: "Every row must include every declared column ID.",
            path: ["rows", rowIndex, "values", column.id],
          });
          continue;
        }

        const value = row.values[column.id];
        if (value === undefined) {
          continue;
        }

        if (!isValueCompatibleWithColumn(value, column.scalarType)) {
          context.addIssue({
            code: "custom",
            message: `Value must match the ${column.scalarType} column type.`,
            path: ["rows", rowIndex, "values", column.id],
          });
        }
      }

      for (const key of valueKeys) {
        if (!columnIds.has(key)) {
          context.addIssue({
            code: "custom",
            message: "Row values may only use declared column IDs.",
            path: ["rows", rowIndex, "values", key],
          });
        }
      }
    }
  });

export type Dataset = z.infer<typeof datasetSchema>;
export type DatasetColumn = z.infer<typeof datasetColumnSchema>;
export type DatasetRow = z.infer<typeof datasetRowSchema>;
export type DatasetSource = z.infer<typeof datasetSourceSchema>;
