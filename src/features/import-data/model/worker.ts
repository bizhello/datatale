import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import readXlsxFile from "read-excel-file/web-worker";
import { Parser } from "saxen";
import { inputLimits } from "@/shared/config";
import { ImportError } from "../lib/import-error";
import { normalizeTable } from "./normalize";
import { parseCsv } from "./parse-csv";
import { prepareWorksheet } from "./prepare-worksheet";
import type { WorkerRequest } from "./worker-protocol";

export function preflightXlsx(bytes: Uint8Array) {
  let entries = 0;
  let inflated = 0;
  let failure: ImportError | undefined;
  let formulas = false;
  const physicalCells = { count: 0 };
  const physicalRows = { count: 0 };
  const fail = (message: string, code: string) => {
    failure ??= new ImportError(message, code);
  };
  const unzip = new Unzip((file) => {
    entries += 1;
    if (entries > inputLimits.zipEntries) {
      fail("В книге слишком много архивных частей.", "zip-entries");
      return;
    }
    const inspect =
      file.name.endsWith(".xml") || file.name.endsWith(".xml.rels");
    const checker = inspect
      ? createWorksheetChecker(
          fail,
          () => {
            formulas = true;
          },
          physicalCells,
          physicalRows,
        )
      : undefined;
    const decoder = inspect ? new TextDecoder() : undefined;
    file.ondata = (error, chunk, final) => {
      if (error) {
        fail("Не удалось распаковать XLSX-файл.", "invalid-xlsx");
        return;
      }
      inflated += chunk.length;
      if (inflated > inputLimits.zipInflatedBytes)
        fail("XLSX после распаковки превышает 16 МБ.", "zip-size");
      if (checker && decoder && !failure)
        checker.write(decoder.decode(chunk, { stream: true }));
      if (final && checker && decoder && !failure) {
        checker.write(decoder.decode());
        checker.end();
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  try {
    for (let offset = 0; offset < bytes.length && !failure; offset += 8 * 1024)
      unzip.push(
        bytes.subarray(offset, Math.min(bytes.length, offset + 8 * 1024)),
        offset + 8 * 1024 >= bytes.length,
      );
  } catch {
    fail("Файл не является корректной XLSX-книгой.", "invalid-xlsx");
  }
  if (failure) throw failure;
  return formulas;
}

function createWorksheetChecker(
  fail: (message: string, code: string) => void,
  foundFormula: () => void,
  physicalCells: { count: number },
  physicalRows: { count: number },
) {
  let worksheet = false;
  const parser = new Parser({ proxy: true });
  parser.on("openTag", (element) => {
    const name = element.name.split(":").at(-1);
    if (name === "worksheet") worksheet = true;
    if (worksheet && name === "row") {
      physicalRows.count += 1;
      if (physicalRows.count > inputLimits.xlsxSparseRows)
        fail("Лист содержит слишком много XML-строк.", "dimensions-limit");
      validatePhysicalRow(element.attrs.r, fail);
    }
    if (worksheet && name === "c") {
      physicalCells.count += 1;
      validatePhysicalCoordinate(element.attrs.r, fail);
      if (physicalCells.count > inputLimits.physicalCells)
        fail("Лист содержит слишком много ячеек.", "cells-limit");
    }
    if (worksheet && name === "f") foundFormula();
  });
  parser.on("error", () =>
    fail("XLSX содержит некорректный XML листа.", "invalid-xlsx"),
  );
  return {
    write(value: string) {
      parser.write(value);
    },
    end() {
      parser.end();
    },
  };
}

function validatePhysicalRow(
  value: unknown,
  fail: (message: string, code: string) => void,
) {
  if (
    value !== undefined &&
    (typeof value !== "string" ||
      !/^[1-9]\d*$/.test(value) ||
      Number(value) > inputLimits.xlsxSparseRows)
  )
    fail("Структура листа слишком разрежена.", "dimensions-limit");
}

function validatePhysicalCoordinate(
  value: unknown,
  fail: (message: string, code: string) => void,
) {
  if (
    typeof value !== "string" ||
    !/^[A-Z]+[1-9]\d*$/.test(value) ||
    coordinateColumn(value) > inputLimits.xlsxSparseColumns ||
    coordinateRow(value) > inputLimits.xlsxSparseRows
  )
    fail("Структура листа слишком разрежена.", "dimensions-limit");
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
  let sheetNames: string[] | undefined;
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
      const result = parseCsv(await file.text(), file.name);
      self.postMessage({ id, kind: "success", result });
      return;
    }
    if (!name.endsWith(".xlsx"))
      throw new ImportError("Выберите CSV или XLSX-файл.", "unsupported-file");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hasCachedFormula = preflightXlsx(bytes);
    const sheets = await readXlsxFile(file, {
      parseNumber: (value) => value,
    });
    const names = sheets.map((sheet) => sheet.sheet);
    sheetNames = names;
    const selected = sheets.find(
      (sheet) => sheet.sheet === (selectedSheet ?? names[0]),
    );
    if (!selected)
      throw new ImportError(
        "Выбранный лист больше недоступен.",
        "missing-sheet",
      );
    const table = prepareWorksheet(selected.data);
    inspectDimensions([table.headers, ...table.rows]);
    const result = normalizeTable(table, {
      kind: "xlsx",
      filename: file.name,
      sheet: selected.sheet,
    });
    self.postMessage({
      id,
      kind: "success",
      result: {
        ...result,
        sheetNames,
        warnings: hasCachedFormula
          ? [
              ...result.warnings,
              {
                code: "cached-formula",
                message:
                  "Значения формул взяты из сохранённого Excel-кэша и не пересчитывались.",
              },
            ]
          : result.warnings,
      },
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
      error: {
        message: known.message,
        code: known.code,
        sheetNames,
      },
    });
  }
};
