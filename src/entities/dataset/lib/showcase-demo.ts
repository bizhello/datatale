import { showcaseDemoFilename, showcaseDemoTable } from "@/shared/config";
import { stableJson } from "@/shared/lib/stable-json";
import { type Dataset, datasetSchema } from "../model/schema";
import type { TextSource } from "../model/text-source";

function demoShape() {
  return {
    source: { kind: "csv" as const, filename: showcaseDemoFilename },
    columns: showcaseDemoTable.headers.map((label, index) => ({
      id: `column_${index + 1}`,
      label,
      scalarType: index === 0 ? ("string" as const) : ("number" as const),
    })),
    rows: showcaseDemoTable.rows.map((row, rowIndex) => ({
      id: `row_${rowIndex + 1}`,
      values: Object.fromEntries(
        row.map((value, columnIndex) => [
          `column_${columnIndex + 1}`,
          columnIndex === 0 ? value : Number(value),
        ]),
      ),
      provenance: { sourceRowNumber: rowIndex + 2 },
    })),
  };
}

export function createShowcaseDemoSource(): Dataset {
  return datasetSchema.parse({
    version: 1,
    id: `dataset_${crypto.randomUUID()}`,
    ...demoShape(),
  });
}

export function isShowcaseDemoSource(
  source: Dataset | TextSource,
): source is Dataset {
  if (!("rows" in source)) return false;
  return (
    stableJson({
      source: source.source,
      columns: source.columns,
      rows: source.rows,
    }) === stableJson(demoShape())
  );
}
