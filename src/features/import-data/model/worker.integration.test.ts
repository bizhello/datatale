import { strToU8, zipSync } from "fflate";
import readXlsxFile from "read-excel-file/web-worker";
import { describe, expect, it, vi } from "vitest";
import { createMultiSheetXlsx } from "../../../../tests/fixtures/import/xlsx";
import { preflightXlsx } from "./worker";

vi.mock("read-excel-file/web-worker", () => ({ default: vi.fn() }));

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
    const atLimit = {
      "a.xml": strToU8(sheet(2501)),
      "b.xml": strToU8(sheet(2500)),
    };
    expect(() => preflightXlsx(zipSync(atLimit))).not.toThrow();
    expect(() =>
      preflightXlsx(
        zipSync({
          ...atLimit,
          "c.xml": strToU8(
            '<worksheet><dimension ref="A1"/><sheetData><row><c r="A1"/></row></sheetData></worksheet>',
          ),
        }),
      ),
    ).toThrow(/слишком много ячеек/);
  });
  it("accepts the real multi-sheet XLSX fixture", () => {
    expect(preflightXlsx(createMultiSheetXlsx())).toBe(false);
  });
  it("ignores an empty generated tail outside the data row limit", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet(
          '<worksheet><sheetData><row r="1"><c r="A1"><v>Header</v></c></row><row r="5002"><c r="A5002"/></row></sheetData></worksheet>',
        ),
      ),
    ).not.toThrow();
  });
  it("rejects an unsafe sparse coordinate even when its cell is empty", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet(
          '<worksheet><sheetData><row r="10002"><c r="A10002"/></row></sheetData></worksheet>',
        ),
      ),
    ).toThrow(/разрежена/);
  });
  it("rejects an unsafe sparse empty row without cells", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet(
          '<worksheet><sheetData><row r="1048576"/></sheetData></worksheet>',
        ),
      ),
    ).toThrow(/разрежена/);
  });
  it("limits empty XML rows without explicit coordinates", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet(
          `<worksheet><sheetData>${"<row/>".repeat(10_002)}</sheetData></worksheet>`,
        ),
      ),
    ).toThrow(/XML-строк/);
  });
  it("defers logical row limits until introductory rows are removed", () => {
    expect(() =>
      preflightXlsx(
        workbookWithSheet(
          '<worksheet><sheetData><row r="5005"><c r="A5005"><v>data</v></c></row></sheetData></worksheet>',
        ),
      ),
    ).not.toThrow();
  });
  it("guards worksheet XML at alternate archive paths but accepts metadata XML", () => {
    expect(() =>
      preflightXlsx(
        zipSync({
          "custom/alternate.xml.rels": strToU8(
            '<worksheet><sheetData><row><c r="BI1"/></row></sheetData></worksheet>',
          ),
        }),
      ),
    ).toThrow(/разрежена/);
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

describe("XLSX worker requests", () => {
  it("rejects a populated footer outside the inferred table width", async () => {
    const padded = (values: unknown[]) => [
      ...values,
      ...Array.from({ length: 10 - values.length }, () => null),
    ];
    vi.mocked(readXlsxFile).mockResolvedValue([
      {
        sheet: "Report",
        data: [
          padded(["Region", "Revenue", "Orders"]),
          padded(["Moscow", 120, 4]),
          padded(["Kazan", 180, 7]),
          [
            "Source note",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            "End",
          ],
        ],
      },
    ]);
    const postMessage = vi
      .spyOn(self, "postMessage")
      .mockImplementation(() => undefined);
    const onmessage = self.onmessage as unknown as (
      event: MessageEvent,
    ) => Promise<void>;

    await onmessage(
      new MessageEvent("message", {
        data: {
          id: "footer-note",
          file: new File([createMultiSheetXlsx()], "report.xlsx"),
        },
      }),
    );

    expect(postMessage.mock.calls[0]?.[0]).toMatchObject({
      kind: "error",
      error: { code: "ragged-row" },
    });
  });

  it("accepts 5,000 data rows after introductory report rows", async () => {
    vi.mocked(readXlsxFile).mockResolvedValue([
      {
        sheet: "Report",
        data: [
          ["Sales report"],
          ["Generated fixture"],
          ["Region", "Value"],
          ...Array.from({ length: 5_000 }, (_, index) => [
            `Region ${index}`,
            index,
          ]),
        ],
      },
    ]);
    const postMessage = vi
      .spyOn(self, "postMessage")
      .mockImplementation(() => undefined);
    const onmessage = self.onmessage as unknown as (
      event: MessageEvent,
    ) => Promise<void>;

    await onmessage(
      new MessageEvent("message", {
        data: {
          id: "maximum-logical-rows",
          file: new File([createMultiSheetXlsx()], "report.xlsx"),
        },
      }),
    );

    const response = postMessage.mock.calls[0]?.[0] as {
      kind: string;
      result: { source: { rows: unknown[] } };
    };
    expect(response.kind).toBe("success");
    expect(response.result.source.rows).toHaveLength(5_000);
  });

  it("imports a table below introductory report rows", async () => {
    vi.mocked(readXlsxFile).mockResolvedValue([
      {
        sheet: "Report",
        data: [
          [null, null, null],
          ["Sales report", null, null],
          ["Region", "Revenue", "Orders"],
          ["Moscow", 120, 4],
        ],
      },
    ]);
    const postMessage = vi
      .spyOn(self, "postMessage")
      .mockImplementation(() => undefined);
    const onmessage = self.onmessage as unknown as (
      event: MessageEvent,
    ) => Promise<void>;

    await onmessage(
      new MessageEvent("message", {
        data: {
          id: "introductory-rows",
          file: new File([createMultiSheetXlsx()], "report.xlsx"),
        },
      }),
    );

    const response = postMessage.mock.calls[0]?.[0] as {
      kind: string;
      result: {
        source: {
          columns: Array<{ label: string }>;
          rows: Array<{ provenance: { sourceRowNumber: number } }>;
        };
      };
    };
    expect(response.kind).toBe("success");
    expect(
      response.result.source.columns.map((column) => column.label),
    ).toEqual(["Region", "Revenue", "Orders"]);
    expect(response.result.source.rows[0]?.provenance.sourceRowNumber).toBe(4);
  });

  it("reads each file independently during one worker lifetime", async () => {
    vi.mocked(readXlsxFile).mockImplementation(async (file) =>
      (file instanceof File ? file.name : "") === "first.xlsx"
        ? [{ sheet: "First", data: [["First column"], ["First value"]] }]
        : [{ sheet: "Second", data: [["Second column"], ["Second value"]] }],
    );
    const postMessage = vi
      .spyOn(self, "postMessage")
      .mockImplementation(() => undefined);
    const onmessage = self.onmessage as unknown as (
      event: MessageEvent,
    ) => Promise<void>;
    const request = (name: string) =>
      onmessage(
        new MessageEvent("message", {
          data: {
            id: name,
            file: new File([createMultiSheetXlsx()], name),
          },
        }),
      );

    await request("first.xlsx");
    await request("second.xlsx");

    const secondResponse = postMessage.mock.calls[1]?.[0] as {
      kind: string;
      result: {
        sheetNames?: string[];
        source: { columns: Array<{ label: string }> };
      };
    };
    expect(secondResponse.kind).toBe("success");
    expect(secondResponse.result.sheetNames).toEqual(["Second"]);
    expect(secondResponse.result.source.columns[0]?.label).toBe(
      "Second column",
    );
  });
});
