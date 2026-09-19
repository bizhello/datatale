import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/features/import-data/model/parse-csv";

const demoCsv = readFileSync(resolve("docs/demo-data.csv"), "utf8");

function numericTotal(values: unknown[]) {
  return values.reduce<number>((total, value) => {
    if (typeof value !== "number") throw new Error("Expected numeric revenue");
    return total + value;
  }, 0);
}

describe("submission demo data", () => {
  it("stays importable and matches every published deterministic total", () => {
    const result = parseCsv(demoCsv, "demo-data.csv");
    if ("rawText" in result.source) throw new Error("Expected a table source");

    const ids = Object.fromEntries(
      result.source.columns.map((column) => [column.label, column.id]),
    );
    const values = result.source.rows.map((row) => row.values);
    const revenueId = ids.revenue;
    const dateId = ids.date;
    const regionId = ids.region;
    const channelId = ids.channel;
    if (!revenueId || !dateId || !regionId || !channelId)
      throw new Error("Demo columns are incomplete");

    const totalWhere = (matches: (row: (typeof values)[number]) => boolean) =>
      numericTotal(values.filter(matches).map((row) => row[revenueId]));

    expect(result.source.rows).toHaveLength(12);
    expect(
      result.source.columns.map(({ label, scalarType }) => [label, scalarType]),
    ).toEqual([
      ["date", "date"],
      ["channel", "string"],
      ["region", "string"],
      ["revenue", "number"],
    ]);
    expect(totalWhere(() => true)).toBe(274_000);
    expect(totalWhere((row) => row[dateId] === "2026-01-01")).toBe(128_000);
    expect(totalWhere((row) => row[dateId] === "2026-02-01")).toBe(146_000);
    expect(totalWhere((row) => row[regionId] === "North")).toBe(120_000);
    expect(totalWhere((row) => row[regionId] === "South")).toBe(154_000);
    expect(totalWhere((row) => row[channelId] === "Online")).toBe(174_000);
    expect(totalWhere((row) => row[channelId] === "Retail")).toBe(100_000);
  });
});
