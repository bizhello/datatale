import { describe, expect, it } from "vitest";
import type { Dataset, TextSource } from "@/entities/dataset";
import {
  isoDateValues,
  numericValues,
  sourceReferences,
  textEvidence,
} from "./source-context";

describe("numericValues", () => {
  it("parses Russian thousands separators as one numeric value", () => {
    expect(numericValues("Итого: 13 000 ₽ или 13\u00a0000 ₽")).toEqual([
      13_000, 13_000,
    ]);
  });

  it("does not treat ISO date components as numeric claims", () => {
    expect(numericValues("Дата отчёта: 2026-09-21")).toEqual([]);
    expect(isoDateValues("Дата отчёта: 2026-09-21")).toEqual(["2026-09-21"]);
  });
});

describe("textEvidence", () => {
  it("keeps a numeric token intact when a long word crosses a chunk boundary", () => {
    const source: TextSource = {
      version: 1,
      id: "long-text",
      source: { kind: "text" },
      rawText: `${"x".repeat(995)}1234567890 кошек`,
      paragraphs: [{ index: 1, text: `${"x".repeat(995)}1234567890 кошек` }],
    };

    const chunks = textEvidence(source);

    expect(chunks.every((chunk) => chunk.text.length <= 1_000)).toBe(true);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]?.text).toContain("1234567890 кошек");
  });
});

describe("sourceReferences", () => {
  it("keeps a row date grounded when it follows a truncated display field", () => {
    const source: Dataset = {
      version: 1,
      id: "dated-row",
      source: { kind: "csv" },
      columns: [
        { id: "note", label: "Примечание", scalarType: "string" },
        { id: "date", label: "Дата", scalarType: "date" },
      ],
      rows: [
        {
          id: "r1",
          values: { note: "x".repeat(1_100), date: "2026-09-21" },
          provenance: { sourceRowNumber: 2 },
        },
      ],
    };

    const reference = sourceReferences(source)[0];
    expect(reference?.excerpt).not.toContain("2026-09-21");
    expect(reference?.isoDates).toEqual(["2026-09-21"]);
  });
});
