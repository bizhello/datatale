import Papa from "papaparse";
import { normalizeTable } from "./normalize";
import { ImportError, type ImportResult } from "./types";

export function parseCsv(text: string, filename: string): ImportResult {
  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  let previousCursor = 0;
  let physicalLine = 1;
  const records: Array<{ row: string[]; sourceRowNumber: number }> = [];
  const errors: Papa.ParseError[] = [];
  Papa.parse<string[]>(source, {
    skipEmptyLines: false,
    step: ({ data, errors: rowErrors, meta }) => {
      errors.push(...rowErrors);
      records.push({ row: data, sourceRowNumber: physicalLine });
      physicalLine += (
        source.slice(previousCursor, meta.cursor).match(/\r\n|\r|\n/g) ?? []
      ).length;
      previousCursor = meta.cursor;
    },
  });
  if (errors.length)
    throw new ImportError(
      `CSV не удалось прочитать: ${errors[0]?.message ?? "неизвестная ошибка"}.`,
      "invalid-csv",
    );
  const [header, ...body] = records;
  if (!header) throw new ImportError("В CSV нет заголовка.", "empty-header");
  const accepted = body.filter(({ row }) => row.some((cell) => cell.trim()));
  return normalizeTable(
    {
      headers: header.row,
      rows: accepted.map(({ row }) => row),
      sourceRowNumbers: accepted.map(({ sourceRowNumber }) => sourceRowNumber),
    },
    { kind: "csv", filename },
  );
}
