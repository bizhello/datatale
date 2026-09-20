import { describe, expect, it } from "vitest";
import { prepareWorksheet } from "./prepare-worksheet";

describe("prepareWorksheet", () => {
  it("uses the first fullest row as the header after report metadata", () => {
    const table = prepareWorksheet([
      [null, null, null],
      ["Sales report", null, null],
      ["Synthetic data", null, null],
      [null, null, null],
      ["Region", "Revenue", "Orders"],
      ["Moscow", 120, 4],
    ]);

    expect(table).toEqual({
      headers: ["Region", "Revenue", "Orders"],
      rows: [["Moscow", 120, 4]],
      sourceRowOffset: 5,
    });
  });

  it("rejects a worksheet without populated cells", () => {
    expect(() => prepareWorksheet([[null], [" "]])).toThrow(/заголовка/);
  });

  it("keeps a partly blank header instead of selecting a data row", () => {
    expect(
      prepareWorksheet([
        ["Report", null, null, null],
        ["Region", null, "Revenue", "Orders"],
        ["Moscow", "Retail", 120, 4],
      ]).headers,
    ).toEqual(["Region", "", "Revenue", "Orders"]);
  });

  it("does not treat a two-cell report caption as a table header", () => {
    expect(
      prepareWorksheet([
        ["Sales report", null, "2026"],
        ["Region", "Revenue", "Orders"],
        ["Moscow", 120, 4],
      ]).headers,
    ).toEqual(["Region", "Revenue", "Orders"]);
  });

  it("uses the label row between a same-width caption and typed data", () => {
    expect(
      prepareWorksheet([
        ["Sales report", "2026"],
        ["Region", "Revenue"],
        ["Moscow", 120],
      ]).headers,
    ).toEqual(["Region", "Revenue"]);
  });

  it("ignores typed metadata before the inferred table", () => {
    expect(
      prepareWorksheet([
        ["Sales report", null, null],
        ["Year", 2026, null],
        [null, null, null],
        ["Region", "Revenue", "Orders"],
        ["Moscow", 120, 4],
      ]).headers,
    ).toEqual(["Region", "Revenue", "Orders"]);
  });

  it("rejects an ambiguous sparse header before string-only data", () => {
    expect(() =>
      prepareWorksheet([
        ["Region", null, null],
        ["Moscow", "Retail", "Done"],
        ["Kazan", "B2B", "Done"],
      ]),
    ).toThrow(/надёжно определить строку заголовков/);
  });

  it("preserves blank header cells before a full-width data row", () => {
    expect(
      prepareWorksheet([
        ["Region", null, "Orders", null],
        ["Moscow", "Retail", 4, "Done"],
        ["Kazan", "B2B", 7, "Done"],
      ]).headers,
    ).toEqual(["Region", "", "Orders", ""]);
  });

  it("preserves trailing blank header cells before typed data", () => {
    expect(
      prepareWorksheet([
        ["Region", "Orders", null, null],
        ["Moscow", 4, "Retail", "Done"],
        ["Kazan", 7, "B2B", "Done"],
      ]).headers,
    ).toEqual(["Region", "Orders", "", ""]);
  });

  it("keeps a wider footer note visible to table validation", () => {
    expect(
      prepareWorksheet([
        [
          "Region",
          "Revenue",
          "Orders",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        ["Moscow", 120, 4, null, null, null, null, null, null, null],
        ["Kazan", 180, 7, null, null, null, null, null, null, null],
        ["Source note", null, null, null, null, null, null, null, null, "End"],
      ]).rows.at(-1),
    ).toHaveLength(10);
  });

  it("rejects a wider row inside the table instead of truncating data", () => {
    const table = prepareWorksheet([
      ["Region", "Revenue", "Orders"],
      ["Moscow", 120, 4],
      ["Kazan", 180, 7, "unexpected"],
      ["Omsk", 90, 2],
    ]);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[1]).toHaveLength(4);
  });

  it("preserves a sparse optional trailing column declared by the header", () => {
    const table = prepareWorksheet([
      ["Region", "Value", "Note"],
      ["Moscow", 10, "Priority"],
      ["Kazan", 20, null],
      ["Omsk", 30, null],
      ["Perm", 40, null],
    ]);
    expect(table.headers).toEqual(["Region", "Value", "Note"]);
    expect(table.rows).toHaveLength(4);
  });

  it("rejects an internal blank row instead of truncating later data", () => {
    expect(() =>
      prepareWorksheet([
        ["Region", "Value"],
        ["Moscow", 10],
        [null, null],
        ["Kazan", 20],
      ]),
    ).toThrow(/внутри таблицы пуста/);
  });
});
