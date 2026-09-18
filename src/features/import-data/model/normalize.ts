import { z } from "zod";
import {
  type Dataset,
  datasetSchema,
  textSourceSchema,
} from "@/entities/dataset";
import { inputLimits } from "@/shared/config";
import {
  ImportError,
  type ImportResult,
  type ImportWarning,
  type ParsedTable,
} from "./types";

const identifierPattern = /^0\d+$/;
const plainNumberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function safeId(label: string, index: number, taken: Set<string>) {
  const base =
    label
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9_]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || `column_${index + 1}`;
  let id = base === "__proto__" ? `column_${index + 1}` : base;
  let suffix = 2;
  while (taken.has(id)) id = `${base}_${suffix++}`;
  taken.add(id);
  return id;
}

function labelFor(header: unknown, index: number, used: Map<string, number>) {
  const original = String(header ?? "").trim();
  const base = original || `Столбец ${index + 1}`;
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count ? `${base} (${count + 1})` : base;
}

function inferType(values: unknown[]) {
  const populated = values.filter(
    (value) =>
      value !== null &&
      value !== undefined &&
      !(typeof value === "string" && !value.trim()),
  );
  if (populated.length === 0) return "string" as const;
  if (
    populated.every(
      (value) =>
        typeof value === "number" ||
        (typeof value === "string" &&
          plainNumberPattern.test(value) &&
          !identifierPattern.test(value) &&
          (value.includes(".")
            ? isLosslessDecimal(value)
            : Number.isSafeInteger(Number(value)))),
    )
  )
    return "number" as const;
  if (populated.every((value) => typeof value === "boolean"))
    return "boolean" as const;
  if (
    populated.every(
      (value) =>
        value instanceof Date ||
        (typeof value === "string" &&
          isoDatePattern.test(value) &&
          z.iso.date().safeParse(value).success),
    )
  )
    return "date" as const;
  return "string" as const;
}

function isLosslessDecimal(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  const canonical = value.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  return String(number) === canonical;
}

function scalarFor(
  value: unknown,
  type: "string" | "number" | "boolean" | "date",
) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  if (type === "number")
    return typeof value === "number" ? value : Number(String(value).trim());
  if (type === "boolean") return Boolean(value);
  if (type === "date")
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).trim();
  return String(value).trim();
}

export function normalizeTable(
  table: ParsedTable,
  source: Dataset["source"],
): ImportResult {
  if (table.headers.length === 0)
    throw new ImportError(
      "В файле нет строки с названиями столбцов.",
      "empty-header",
    );
  if (table.headers.length > inputLimits.columns)
    throw new ImportError(
      `Можно загрузить до ${inputLimits.columns} столбцов.`,
      "columns-limit",
    );
  if (table.rows.length === 0)
    throw new ImportError("В файле нет строк с данными.", "empty-data");
  if (table.rows.length > inputLimits.rows)
    throw new ImportError(
      `Можно загрузить до ${inputLimits.rows.toLocaleString("ru-RU")} строк.`,
      "rows-limit",
    );
  const usedLabels = new Map<string, number>();
  const ids = new Set<string>();
  const columns: Dataset["columns"] = table.headers.map((header, index) => ({
    id: safeId(String(header ?? ""), index, ids),
    label: labelFor(header, index, usedLabels),
    scalarType: "string",
  }));
  for (const [index, row] of table.rows.entries())
    if (row.length !== columns.length)
      throw new ImportError(
        `Строка ${index + 2} содержит другое число ячеек, чем заголовок.`,
        "ragged-row",
      );
  for (const [index, column] of columns.entries())
    column.scalarType = inferType(table.rows.map((row) => row[index]));
  const hasAmbiguousValues = table.rows
    .flat()
    .some(
      (value) =>
        typeof value === "string" &&
        ((plainNumberPattern.test(value) &&
          value.includes(".") &&
          !isLosslessDecimal(value)) ||
          /\d,\d/.test(value) ||
          /[€$₽£]/.test(value) ||
          /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(value)),
    );
  const warnings: ImportWarning[] = hasAmbiguousValues
    ? [
        {
          code: "ambiguous-value",
          message:
            "Неоднозначные даты, суммы и десятичные значения сохранены как текст.",
        },
      ]
    : [];
  const rows = table.rows.map((inputRow, index) => {
    if (inputRow.length !== columns.length)
      throw new ImportError(
        `Строка ${index + 2} содержит другое число ячеек, чем заголовок.`,
        "ragged-row",
      );
    const values: Record<string, string | number | boolean | null> =
      Object.create(null) as Record<string, string | number | boolean | null>;
    for (const [columnIndex, column] of columns.entries())
      values[column.id] = scalarFor(inputRow[columnIndex], column.scalarType);
    return {
      id: `row_${index + 1}`,
      values,
      provenance: {
        sourceRowNumber:
          table.sourceRowNumbers?.[index] ??
          index + 1 + (table.sourceRowOffset ?? 1),
      },
    };
  });
  const dataset = datasetSchema.parse({
    version: 1,
    id: `dataset_${crypto.randomUUID()}`,
    source,
    columns,
    rows,
  });
  if (
    new TextEncoder().encode(JSON.stringify(dataset)).byteLength >
    inputLimits.canonicalSourceBytes
  )
    throw new ImportError(
      "Нормализованный источник превышает допустимый размер 1 МБ.",
      "source-limit",
    );
  return { source: dataset, warnings: uniqueWarnings(warnings) };
}

function uniqueWarnings(warnings: ImportWarning[]) {
  return warnings.filter(
    (warning, index) =>
      warnings.findIndex((item) => item.code === warning.code) === index,
  );
}

export function normalizeText(rawText: string): ImportResult {
  if (!rawText.trim())
    throw new ImportError("Вставьте текст, чтобы продолжить.", "empty-text");
  if (rawText.length > inputLimits.textCharacters)
    throw new ImportError(
      `Текст ограничен ${inputLimits.textCharacters.toLocaleString("ru-RU")} символами.`,
      "text-limit",
    );
  const paragraphs = rawText
    .split(/\r?\n\s*\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ index: index + 1, text }));
  return {
    source: textSourceSchema.parse({
      version: 1,
      id: `text_${crypto.randomUUID()}`,
      source: { kind: "text" },
      rawText,
      paragraphs,
    }),
    warnings: [],
  };
}
