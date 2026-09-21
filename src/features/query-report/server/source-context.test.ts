import { describe, expect, it } from "vitest";
import type { Dataset, DatasetQuery, TextSource } from "@/entities/dataset";
import {
  isoDateValues,
  numericOccurrences,
  numericValues,
  resultReferences,
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

  it("parses mixed decimal and thousands separators exactly", () => {
    expect(numericValues("1.234,56; 1 234,56; 1'234.56; 1 234,56")).toEqual([
      1234.56, 1234.56, 1234.56, 1234.56,
    ]);
  });

  it("keeps a single dot or comma decimal and removes repeated grouping separators", () => {
    expect(numericValues("1.234; 1,234; 12.345.678; 1,234,567")).toEqual([
      1.234, 1.234, 12345678, 1234567,
    ]);
  });

  it("preserves exact offsets for duplicate and signed localized occurrences", () => {
    const occurrences = numericOccurrences("1'234,56; -3; 1'234,56");
    expect(occurrences.map((item) => item.value)).toEqual([
      1234.56, -3, 1234.56,
    ]);
    expect(occurrences[0]?.start).toBeLessThan(occurrences[2]?.start ?? 0);
    expect(occurrences[0]?.start).not.toBe(occurrences[2]?.start);
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
  it("renders every supported filter operator in code-owned scope labels", () => {
    const source: Dataset = {
      version: 1,
      id: "scopes",
      source: { kind: "csv" },
      columns: [
        { id: "city", label: "Город", scalarType: "string" },
        { id: "sales", label: "Продажи", scalarType: "number" },
      ],
      rows: [
        {
          id: "r1",
          values: { city: "Москва", sales: 10 },
          provenance: { sourceRowNumber: 2 },
        },
      ],
    };
    const operators = [
      "eq",
      "ne",
      "in",
      "lt",
      "lte",
      "gt",
      "gte",
      "contains",
    ] as const;
    const labels = ["=", "≠", "∈", "<", "≤", ">", "≥", "содержит"];
    for (const [index, operator] of operators.entries()) {
      const query = {
        queryId: `q-${index}`,
        purpose: "count",
        filters: [
          {
            fieldId: "city",
            operator,
            value: operator === "in" ? ["Москва"] : "Москва",
          },
        ],
        select: [],
        metrics: [{ id: "total", aggregation: "sum", fieldId: "sales" }],
        orderBy: [],
        limit: 1,
      } as DatasetQuery;
      const references = resultReferences(
        {
          queryId: query.queryId,
          rows: [],
          groups: [],
          metrics: { total: 10 },
          matchedRows: 1,
          scannedRows: 1,
          returnedRows: 0,
          truncated: false,
          rowReferences: [],
        },
        source,
        query,
      );
      expect(references[0]?.scopeLabel).toContain(
        `Город ${labels[index]} Москва`,
      );
    }
  });

  it("namespaces overlapping row evidence by application query ID", () => {
    const source: Dataset = {
      version: 1,
      id: "overlap",
      source: { kind: "csv" },
      columns: [{ id: "city", label: "Город", scalarType: "string" }],
      rows: [
        {
          id: "r1",
          values: { city: "Москва" },
          provenance: { sourceRowNumber: 2 },
        },
      ],
    };
    const result = (queryId: string) =>
      resultReferences(
        {
          queryId,
          rows: [{ city: "Москва" }],
          groups: [],
          metrics: {},
          matchedRows: 1,
          scannedRows: 1,
          returnedRows: 1,
          truncated: false,
          rowReferences: [{ rowId: "r1", sourceRowNumber: 2 }],
        },
        source,
        {
          queryId,
          purpose: "count",
          filters: [],
          select: ["city"],
          metrics: [],
          orderBy: [],
          limit: 1,
        },
      );
    const first = result("q1");
    const second = result("q2");
    expect(first.find((item) => item.id === "row-q1-r1")?.queryId).toBe("q1");
    expect(second.find((item) => item.id === "row-q2-r1")?.queryId).toBe("q2");
    expect(
      first.find((item) => item.id === "row-q1-r1:field:city")?.queryId,
    ).toBe("q1");
    expect(
      second.find((item) => item.id === "row-q2-r1:field:city")?.queryId,
    ).toBe("q2");
  });

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
