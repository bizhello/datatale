import { Unzip, UnzipInflate } from "fflate";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/web-worker";
import { inputLimits } from "@/shared/config/input-limits";
import { normalizeTable } from "./normalize";
import { ImportError } from "./types";

type WorkerRequest = { id: number; file: File; selectedSheet?: string };

function preflightXlsx(bytes: Uint8Array) {
  let entries = 0;
  let inflated = 0;
  let failure: ImportError | undefined;
  const worksheetXml: string[] = [];
  const fail = (message: string, code: string) => {
    failure ??= new ImportError(message, code);
  };
  const unzip = new Unzip((file) => {
    entries += 1;
    if (entries > inputLimits.zipEntries) {
      fail("В книге слишком много архивных частей.", "zip-entries");
      return;
    }
    const inspect = /^xl\/worksheets\/[^/]+\.xml$/.test(file.name);
    file.ondata = (error, chunk) => {
      if (error) {
        fail("Не удалось распаковать XLSX-файл.", "invalid-xlsx");
        return;
      }
      inflated += chunk.length;
      if (inflated > inputLimits.zipInflatedBytes)
        fail("XLSX после распаковки превышает 16 МБ.", "zip-size");
      if (inspect && !failure)
        worksheetXml.push(new TextDecoder().decode(chunk));
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length && !failure; offset += 64 * 1024)
      unzip.push(
        bytes.subarray(offset, Math.min(bytes.length, offset + 64 * 1024)),
        offset + 64 * 1024 >= bytes.length,
      );
  } catch {
    fail("Файл не является корректной XLSX-книгой.", "invalid-xlsx");
  }
  if (failure) throw failure;
  const xml = worksheetXml.join("");
  const dimensions = [
    ...xml.matchAll(/<dimension[^>]*\bref="([A-Z]+\d+)(?::([A-Z]+\d+))?"/g),
  ];
  for (const match of dimensions) {
    const last = match[2] ?? match[1];
    if (
      !last ||
      coordinateColumn(last) > inputLimits.columns ||
      coordinateRow(last) > inputLimits.rows + 1
    )
      throw new ImportError(
        "Размер листа выходит за допустимые границы.",
        "dimensions-limit",
      );
  }
  let cells = 0;
  for (const match of xml.matchAll(/<c[^>]*\br="([A-Z]+\d+)"/g)) {
    cells += 1;
    const coordinate = match[1];
    if (
      !coordinate ||
      coordinateColumn(coordinate) > inputLimits.columns ||
      coordinateRow(coordinate) > inputLimits.rows + 1 ||
      cells > inputLimits.physicalCells
    )
      throw new ImportError(
        "Лист содержит недопустимые координаты или слишком много ячеек.",
        "cells-limit",
      );
  }
}

function coordinateColumn(coordinate: string) {
  return coordinate
    .replace(/\d/g, "")
    .split("")
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}
function coordinateRow(coordinate: string) {
  return Number(coordinate.replace(/\D/g, ""));
}

function inspectDimensions(rows: unknown[][]) {
  if (rows.length > inputLimits.rows + 1)
    throw new ImportError(
      "Лист содержит больше 5 000 строк данных.",
      "rows-limit",
    );
  let cells = 0;
  for (const row of rows) {
    if (row.length > inputLimits.columns)
      throw new ImportError(
        "Лист содержит больше 30 столбцов.",
        "columns-limit",
      );
    cells += row.length;
    if (cells > inputLimits.physicalCells)
      throw new ImportError(
        "Лист содержит слишком много ячеек.",
        "cells-limit",
      );
  }
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    const { id, file, selectedSheet } = data;
    if (file.size > inputLimits.fileBytes)
      throw new ImportError(
        "Размер файла не должен превышать 2 МБ.",
        "file-limit",
      );
    const name = file.name.toLowerCase();
    if (name.endsWith(".xls") && !name.endsWith(".xlsx"))
      throw new ImportError(
        "Формат XLS устарел. Сохраните файл как XLSX и загрузите снова.",
        "legacy-xls",
      );
    if (name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
      if (parsed.errors.length)
        throw new ImportError(
          `CSV не удалось прочитать: ${parsed.errors[0]?.message ?? "неизвестная ошибка"}.`,
          "invalid-csv",
        );
      const [headers, ...rows] = parsed.data;
      if (!headers)
        throw new ImportError("В CSV нет заголовка.", "empty-header");
      const result = normalizeTable(
        { headers, rows },
        { kind: "csv", filename: file.name },
      );
      self.postMessage({ id, kind: "success", result });
      return;
    }
    if (!name.endsWith(".xlsx"))
      throw new ImportError("Выберите CSV или XLSX-файл.", "unsupported-file");
    const bytes = new Uint8Array(await file.arrayBuffer());
    preflightXlsx(bytes);
    const sheets = await readXlsxFile(file);
    const sheetNames = sheets.map((sheet) => sheet.sheet);
    const selected = sheets.find(
      (sheet) => sheet.sheet === (selectedSheet ?? sheetNames[0]),
    );
    if (!selected)
      throw new ImportError(
        "Выбранный лист больше недоступен.",
        "missing-sheet",
      );
    inspectDimensions(selected.data);
    const [headers, ...rows] = selected.data;
    if (!headers)
      throw new ImportError("В выбранном листе нет заголовка.", "empty-header");
    const result = normalizeTable(
      { headers: headers.map(String), rows },
      { kind: "xlsx", filename: file.name, sheet: selected.sheet },
    );
    self.postMessage({
      id,
      kind: "success",
      result: { ...result, sheetNames },
    });
  } catch (error) {
    const known =
      error instanceof ImportError
        ? error
        : new ImportError(
            "Не удалось прочитать файл. Проверьте его и попробуйте снова.",
            "parse-failed",
          );
    self.postMessage({
      id: data.id,
      kind: "error",
      error: { message: known.message, code: known.code },
    });
  }
};
