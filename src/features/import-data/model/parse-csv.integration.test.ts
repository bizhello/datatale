import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse-csv";

describe("CSV to Dataset", () => {
  it("accepts a valid one-column CSV despite Papa's advisory delimiter warning", () => {
    const result = parseCsv("Score\n1\n2", "score.csv");
    if ("rawText" in result.source) throw new Error("Expected dataset");
    expect(result.source.rows.map((row) => row.values.score)).toEqual([1, 2]);
  });
  it("keeps BOM headers, quoted commas/newlines, nulls and physical provenance", () => {
    const result = parseCsv(
      "\uFEFFКод,Описание,Сумма\r\n001," +
        '"строка, с запятой\nи переносом",10\r\n\r\n002,готово,\r\n',
      "report.csv",
    );
    if ("rawText" in result.source) throw new Error("Expected dataset");
    expect(result.source.columns.map((column) => column.label)).toEqual([
      "Код",
      "Описание",
      "Сумма",
    ]);
    expect(result.source.rows).toHaveLength(2);
    expect(result.source.rows[0]?.values).toMatchObject({
      column_1: "001",
      column_2: "строка, с запятой\nи переносом",
      column_3: 10,
    });
    expect(result.source.rows[1]?.values.column_3).toBeNull();
    expect(
      result.source.rows.map((row) => row.provenance.sourceRowNumber),
    ).toEqual([2, 5]);
  });
  it("rejects malformed quotes and maps duplicate/reserved headers safely", () => {
    expect(() => parseCsv('A,B\n"unterminated,2', "broken.csv")).toThrow(/CSV/);
    const result = parseCsv("__proto__,__proto__\n1,2", "headers.csv");
    if ("rawText" in result.source) throw new Error("Expected dataset");
    expect(result.source.columns.map((column) => column.id)).not.toContain(
      "__proto__",
    );
    expect(new Set(result.source.columns.map((column) => column.id)).size).toBe(
      2,
    );
  });
});
