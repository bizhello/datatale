import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createMultiSheetXlsx } from "../../../../tests/fixtures/import/xlsx";
import { preflightXlsx } from "./worker";

function workbookWithSheet(sheetXml: string) {
  return zipSync({ "xl/worksheets/sheet1.xml": strToU8(sheetXml) });
}

describe("XLSX preflight", () => {
  it("enforces physical cell limits across worksheet XML entries", () => {
    const letter = (index: number) =>
      index < 26
        ? String.fromCharCode(65 + index)
        : `A${String.fromCharCode(65 + index - 26)}`;
    const sheet = (rows: number) =>
      `<worksheet><dimension ref="A1:AD${rows}"/><sheetData>${Array.from({ length: rows }, (_, row) => `<row>${Array.from({ length: 30 }, (_, column) => `<c r="${letter(column)}${row + 1}"/>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
    expect(() =>
      preflightXlsx(
        zipSync({
          "a.xml": strToU8(sheet(2501)),
          "b.xml": strToU8(sheet(2501)),
        }),
      ),
    ).toThrow(/слишком много ячеек/);
  });
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
  it("guards worksheet XML at alternate archive paths but accepts metadata XML", () => {
    expect(() =>
      preflightXlsx(
        zipSync({
          "custom/alternate.xml.rels": strToU8(
            '<worksheet><dimension ref="A1:AF5002"/><sheetData><row><c r="AF5002"/></row></sheetData></worksheet>',
          ),
        }),
      ),
    ).toThrow(/Размер листа/);
    expect(() =>
      preflightXlsx(
        zipSync({
          "xl/styles.xml": strToU8("<styleSheet><cellXfs/></styleSheet>"),
          "xl/workbook.xml": strToU8("<workbook><sheets/></workbook>"),
        }),
      ),
    ).not.toThrow();
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
