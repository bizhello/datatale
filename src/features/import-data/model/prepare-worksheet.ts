import { ImportError } from "../lib/import-error";
import type { ParsedTable } from "./types";

function populated(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    !(typeof value === "string" && value.trim() === "")
  );
}

function populatedCells(row: unknown[]) {
  return row.filter(populated).length;
}

function effectiveWidth(row: unknown[]) {
  return row.findLastIndex(populated) + 1;
}

function containsTypedData(row: unknown[]) {
  return row.some((value) => populated(value) && typeof value !== "string");
}

function containsOnlyLabels(row: unknown[]) {
  return (
    populatedCells(row) > 0 &&
    row.every((value) => !populated(value) || typeof value === "string")
  );
}

export function prepareWorksheet(rows: unknown[][]): ParsedTable {
  const populationFrequencies = new Map<number, number>();
  for (const row of rows) {
    const size = populatedCells(row);
    if (size > 0)
      populationFrequencies.set(
        size,
        (populationFrequencies.get(size) ?? 0) + 1,
      );
  }
  const supportedRowSize = [...populationFrequencies]
    .filter(([, frequency]) => frequency >= 2)
    .map(([size]) => size)
    .sort((left, right) => right - left)[0];
  const fullestRowSize =
    supportedRowSize ?? Math.max(0, ...populationFrequencies.keys());
  const firstFullestRow = rows.findIndex(
    (row) => populatedCells(row) === fullestRowSize,
  );
  if (firstFullestRow < 0 || fullestRowSize === 0)
    throw new ImportError("В выбранном листе нет заголовка.", "empty-header");
  const candidate = rows[firstFullestRow];
  const previous = rows[firstFullestRow - 1];
  const typedDataOffset = rows
    .slice(firstFullestRow)
    .findIndex(containsTypedData);
  const firstTypedData =
    typedDataOffset < 0 ? -1 : firstFullestRow + typedDataOffset;
  const typedDataHeader =
    firstTypedData > 0 && containsOnlyLabels(rows[firstTypedData - 1] ?? [])
      ? firstTypedData - 1
      : undefined;
  if (firstTypedData < 0 && firstFullestRow > 0)
    throw new ImportError(
      "Не удалось надёжно определить строку заголовков. Уберите вводные строки или заполните названия столбцов.",
      "ambiguous-header",
    );
  const headerIndex =
    typedDataHeader ??
    (candidate &&
    previous &&
    containsTypedData(candidate) &&
    containsOnlyLabels(previous)
      ? firstFullestRow - 1
      : firstFullestRow);
  const header = rows[headerIndex];
  if (!header)
    throw new ImportError("В выбранном листе нет заголовка.", "empty-header");
  const width = Math.max(
    0,
    ...rows
      .filter((row) => populatedCells(row) === fullestRowSize)
      .map(effectiveWidth),
  );
  const data = rows.slice(headerIndex + 1);
  while (data.length > 0 && populatedCells(data.at(-1) ?? []) === 0) data.pop();
  const blankRow = data.findIndex((row) => populatedCells(row) === 0);
  if (blankRow >= 0)
    throw new ImportError(
      `Строка ${headerIndex + blankRow + 2} внутри таблицы пуста.`,
      "ragged-row",
    );
  const normalizedRow = (row: unknown[]) => {
    if (effectiveWidth(row) > width) return row;
    return Array.from({ length: width }, (_, index) => row[index] ?? null);
  };
  return {
    headers: normalizedRow(header).map((value) => String(value ?? "")),
    rows: data.map(normalizedRow),
    sourceRowOffset: headerIndex + 1,
  };
}
