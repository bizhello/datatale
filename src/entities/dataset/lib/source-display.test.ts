import { describe, expect, it } from "vitest";
import type { Dataset, TextSource } from "../index";
import { sourceDisplaySummary } from "./source-display";

describe("source display summary", () => {
  it("keeps the filename and table dimensions", () => {
    const source = {
      version: 1,
      id: "table",
      source: { kind: "csv", filename: "a-very-long-report-name.csv" },
      columns: [{ id: "x", label: "X", scalarType: "number" }],
      rows: [],
    } satisfies Dataset;
    expect(sourceDisplaySummary(source)).toEqual({
      name: "a-very-long-report-name.csv",
      detail: "0 строк · 1 столбцов",
    });
  });

  it("reports text paragraphs and characters", () => {
    const source = {
      version: 1,
      id: "text",
      source: { kind: "text" },
      rawText: "Hello",
      paragraphs: [{ index: 1, text: "Hello" }],
    } satisfies TextSource;
    expect(sourceDisplaySummary(source).detail).toBe("1 абз. · 5 символов");
  });
});
