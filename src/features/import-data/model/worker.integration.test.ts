import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { preflightXlsx } from "./worker";
import { createMultiSheetXlsx } from "../../../../tests/fixtures/import/xlsx";

function workbookWithSheet(sheetXml: string) {
  return zipSync({ "xl/worksheets/sheet1.xml": strToU8(sheetXml) });
}

describe("XLSX preflight", () => {
  it("accepts the real multi-sheet XLSX fixture", () => {
    expect(preflightXlsx(createMultiSheetXlsx())).toBe(false);
  });
  it("rejects an out-of-range cell before workbook parsing", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet(
          '<worksheet><dimension ref="A1:ZZ5001"/><sheetData><row><c r="ZZ5001"/></row></sheetData></worksheet>',
        ),
      ),
    ).toThrow(/Размер листа/);
  });
  it("rejects malformed worksheet XML and recognizes cached formulas", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet('<worksheet><dimension ref="A1:A2"><sheetData>'),
      ),
    ).toThrow(/XML/);
    expect(
      preflightXlsx(
        workbookWithSheet(
          '<worksheet><dimension ref="A1:A2"/><sheetData><row><c r="A1"><f>SUM(A2)</f></c></row></sheetData></worksheet>',
        ),
      ),
    ).toBe(true);
  });
});
