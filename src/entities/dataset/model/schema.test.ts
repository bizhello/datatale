import { describe, expect, it } from "vitest";

import {
  DATASET_MAX_COLUMNS,
  DATASET_MAX_ROWS,
  DATASET_MIN_COLUMNS,
  DATASET_MIN_ROWS,
  DATASET_SCHEMA_VERSION,
  datasetSchema,
} from "@/entities/dataset";
import { syntheticDatasetFixture } from "../../../../tests/fixtures/dataset";

function cloneFixture(): Record<string, unknown> {
  return structuredClone(syntheticDatasetFixture);
}

type MutableRow = {
  id: string;
  provenance: { sourceRowNumber: number };
  values: Record<string, unknown>;
};

function rowsOf(dataset: Record<string, unknown>): MutableRow[] {
  return dataset.rows as MutableRow[];
}

function requiredItem<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected an item at index ${index}.`);
  }
  return item;
}

function firstRowValues(
  dataset: Record<string, unknown>,
): Record<string, unknown> {
  return requiredItem(rowsOf(dataset), 0).values;
}

describe("datasetSchema", () => {
  it("accepts a normalized table with source provenance and explicit missing values", () => {
    const result = datasetSchema.safeParse(syntheticDatasetFixture);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[1]?.values.revenue).toBeNull();
      expect(result.data.rows[0]?.provenance.sourceRowNumber).toBe(2);
      expect(result.data.rows[1]?.provenance.sourceRowNumber).toBe(3);
    }
  });

  it("rejects malformed IDs, unknown fields, duplicate column IDs, and duplicate row IDs", () => {
    const malformedId = cloneFixture();
    malformedId.id = "";

    const emptyColumnId = cloneFixture();
    requiredItem(emptyColumnId.columns as Array<{ id: string }>, 0).id = "";

    const emptyRowId = cloneFixture();
    requiredItem(rowsOf(emptyRowId), 0).id = "";

    const unknownField = cloneFixture();
    unknownField.unexpected = true;

    const duplicateColumn = cloneFixture();
    const duplicateColumns = duplicateColumn.columns as Array<{ id: string }>;
    requiredItem(duplicateColumns, 1).id = requiredItem(duplicateColumns, 0).id;

    const duplicateRow = cloneFixture();
    const duplicateRows = rowsOf(duplicateRow);
    requiredItem(duplicateRows, 1).id = requiredItem(duplicateRows, 0).id;

    const invalidProvenance = cloneFixture();
    requiredItem(rowsOf(invalidProvenance), 0).provenance.sourceRowNumber = 0;

    expect(datasetSchema.safeParse(malformedId).success).toBe(false);
    expect(datasetSchema.safeParse(emptyColumnId).success).toBe(false);
    expect(datasetSchema.safeParse(emptyRowId).success).toBe(false);
    expect(datasetSchema.safeParse(unknownField).success).toBe(false);
    expect(datasetSchema.safeParse(duplicateColumn).success).toBe(false);
    expect(datasetSchema.safeParse(duplicateRow).success).toBe(false);
    expect(datasetSchema.safeParse(invalidProvenance).success).toBe(false);
  });

  it("rejects values that do not match their declared scalar type", () => {
    const wrongNumber = cloneFixture();
    firstRowValues(wrongNumber).revenue = "1200";

    const wrongBoolean = cloneFixture();
    firstRowValues(wrongBoolean).paid = 1;

    const wrongString = cloneFixture();
    firstRowValues(wrongString).note = false;

    expect(datasetSchema.safeParse(wrongNumber).success).toBe(false);
    expect(datasetSchema.safeParse(wrongBoolean).success).toBe(false);
    expect(datasetSchema.safeParse(wrongString).success).toBe(false);
  });

  it("requires exactly the declared column keys while allowing null for missing data", () => {
    const missingKey = cloneFixture();
    delete firstRowValues(missingKey).note;

    const extraKey = cloneFixture();
    firstRowValues(extraKey).extra = "unexpected";

    const nullValues = cloneFixture();
    firstRowValues(nullValues).date = null;
    firstRowValues(nullValues).revenue = null;
    firstRowValues(nullValues).paid = null;
    firstRowValues(nullValues).note = null;

    expect(datasetSchema.safeParse(missingKey).success).toBe(false);
    expect(datasetSchema.safeParse(extraKey).success).toBe(false);
    expect(datasetSchema.safeParse(nullValues).success).toBe(true);
  });

  it("rejects invalid and non-finite numbers", () => {
    const invalidNumber = cloneFixture();
    firstRowValues(invalidNumber).revenue = Number.NaN;

    const infiniteNumber = cloneFixture();
    firstRowValues(infiniteNumber).revenue = Number.POSITIVE_INFINITY;

    expect(datasetSchema.safeParse(invalidNumber).success).toBe(false);
    expect(datasetSchema.safeParse(infiniteNumber).success).toBe(false);
  });

  it("accepts leap-day dates and rejects malformed or impossible calendar dates", () => {
    const leapDay = cloneFixture();
    firstRowValues(leapDay).date = "2024-02-29";

    const impossibleDate = cloneFixture();
    firstRowValues(impossibleDate).date = "2025-02-29";

    const malformedDate = cloneFixture();
    firstRowValues(malformedDate).date = "2026/01/31";

    expect(datasetSchema.safeParse(leapDay).success).toBe(true);
    expect(datasetSchema.safeParse(impossibleDate).success).toBe(false);
    expect(datasetSchema.safeParse(malformedDate).success).toBe(false);
  });

  it("enforces version and row and column boundaries", () => {
    const wrongVersion = cloneFixture();
    wrongVersion.version = DATASET_SCHEMA_VERSION + 1;

    const noColumns = cloneFixture();
    noColumns.columns = [];

    const tooManyColumns = cloneFixture();
    tooManyColumns.columns = Array.from(
      { length: DATASET_MAX_COLUMNS + 1 },
      (_, index) => ({
        id: `column-${index}`,
        label: `Column ${index}`,
        scalarType: "string",
      }),
    );
    tooManyColumns.rows = [
      {
        id: "row-1",
        values: Object.fromEntries(
          Array.from({ length: DATASET_MAX_COLUMNS + 1 }, (_, index) => [
            `column-${index}`,
            "value",
          ]),
        ),
        provenance: { sourceRowNumber: 1 },
      },
    ];

    const noRows = cloneFixture();
    noRows.rows = [];

    const smallestDataset = cloneFixture();
    smallestDataset.columns = [
      { id: "value", label: "Value", scalarType: "string" },
    ];
    smallestDataset.rows = [
      {
        id: "row-1",
        values: { value: "ok" },
        provenance: { sourceRowNumber: 1 },
      },
    ];

    const maxRows = cloneFixture();
    maxRows.rows = Array.from({ length: DATASET_MAX_ROWS }, (_, index) => ({
      id: `row-${index}`,
      values: { date: "2026-01-01", revenue: index, paid: true, note: "ok" },
      provenance: { sourceRowNumber: index + 1 },
    }));

    const tooManyRows = cloneFixture();
    tooManyRows.rows = Array.from(
      { length: DATASET_MAX_ROWS + 1 },
      (_, index) => ({
        id: `row-${index}`,
        values: { date: "2026-01-01", revenue: index, paid: true, note: "ok" },
        provenance: { sourceRowNumber: index + 1 },
      }),
    );

    expect(DATASET_MIN_COLUMNS).toBe(1);
    expect(DATASET_MIN_ROWS).toBe(1);
    expect(datasetSchema.safeParse(wrongVersion).success).toBe(false);
    expect(datasetSchema.safeParse(noColumns).success).toBe(false);
    expect(datasetSchema.safeParse(tooManyColumns).success).toBe(false);
    expect(datasetSchema.safeParse(noRows).success).toBe(false);
    expect(datasetSchema.safeParse(smallestDataset).success).toBe(true);
    expect(datasetSchema.safeParse(maxRows).success).toBe(true);
    expect(datasetSchema.safeParse(tooManyRows).success).toBe(false);
  });

  it("keeps original source row references stable when rows are reordered", () => {
    const reordered = cloneFixture();
    const rows = rowsOf(reordered);
    reordered.rows = [...rows].reverse();

    const result = datasetSchema.safeParse(reordered);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        result.data.rows.map((row) => row.provenance.sourceRowNumber),
      ).toEqual([3, 2]);
    }
  });
});
