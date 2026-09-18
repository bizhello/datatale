import { describe, expect, it } from "vitest";
import { inputLimits } from "@/shared/config/input-limits";
import { normalizeTable, normalizeText } from "./normalize";

describe("normalizeTable", () => {
  it("preserves source labels and rows while generating safe unique ids", () => {
    const result = normalizeTable(
      {
        headers: ["__proto__", "", "Сумма", "Сумма"],
        rows: [
          ["0012", "", "1,20", "2024-02-30"],
          ["0013", "ok", "2,30", "2024-03-01"],
        ],
      },
      { kind: "csv", filename: "report.csv" },
    );
    if ("rawText" in result.source) throw new Error("Expected table");
    expect(result.source.columns.map((column) => column.id)).toEqual([
      "proto",
      "column_2",
      "column_3",
      "column_4",
    ]);
    expect(result.source.columns.map((column) => column.label)).toEqual([
      "__proto__",
      "Столбец 2",
      "Сумма",
      "Сумма (2)",
    ]);
    expect(result.source.rows[0]?.values.proto).toBe("0012");
    expect(result.source.rows[0]?.values.column_3).toBe("1,20");
    expect(result.source.rows[0]?.provenance.sourceRowNumber).toBe(2);
  });
  it("rejects a ragged row and one row over the limit", () => {
    expect(() =>
      normalizeTable({ headers: ["A", "B"], rows: [["1"]] }, { kind: "csv" }),
    ).toThrow(/другое число/);
    expect(() =>
      normalizeTable(
        {
          headers: ["A"],
          rows: Array.from({ length: inputLimits.rows + 1 }, () => ["1"]),
        },
        { kind: "csv" },
      ),
    ).toThrow(/5\s*000/);
  });
});
describe("normalizeText", () => {
  it("keeps raw prose and paragraph provenance", () => {
    const result = normalizeText("Первый абзац.\n\nВторой абзац.");
    if (!("rawText" in result.source)) throw new Error("Expected text");
    expect(result.source.rawText).toBe("Первый абзац.\n\nВторой абзац.");
    expect(result.source.paragraphs).toEqual([
      { index: 1, text: "Первый абзац." },
      { index: 2, text: "Второй абзац." },
    ]);
  });
  it("rejects text one character over the limit", () => {
    expect(() =>
      normalizeText("a".repeat(inputLimits.textCharacters + 1)),
    ).toThrow(/30\s*000/);
  });
});
