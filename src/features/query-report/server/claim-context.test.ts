import { describe, expect, it } from "vitest";
import { CHAT_CONTEXT_MAX_SERIALIZED_BYTES } from "@/entities/chat";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { buildProviderContext } from "./claim-context";

const report: FinalReport = {
  version: 1,
  hero: [
    {
      text: "Checked report.",
      factIds: ["total"],
      evidenceIds: ["rows-all"],
      kind: "observation",
    },
    {
      text: "Checked source.",
      factIds: [],
      evidenceIds: ["rows-all"],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "total",
      label: "Total",
      value: 1,
      calculation: { kind: "count" },
      evidenceIds: ["rows-all"],
    },
  ],
  charts: [],
  evidence: [
    {
      id: "rows-all",
      kind: "row-range",
      label: "All rows",
      coverage: { included: 5_000, total: 5_000 },
    },
  ],
  recommendations: [],
  noChartReason: "No chart.",
};

describe("bounded chat claim context", () => {
  it("marks common-value retrieval as truncated without exceeding the byte budget", () => {
    const source: Dataset = {
      version: 1,
      id: "large",
      source: { kind: "csv" },
      columns: Array.from({ length: 13 }, (_, index) => ({
        id: `column-${index}`,
        label: `Column ${index}`,
        scalarType: "string" as const,
      })),
      rows: Array.from({ length: 5_000 }, (_, rowIndex) => ({
        id: `row-${rowIndex}`,
        values: Object.fromEntries(
          Array.from({ length: 13 }, (_, columnIndex) => [
            `column-${columnIndex}`,
            `Moscow value ${rowIndex}-${columnIndex}`,
          ]),
        ),
        provenance: { sourceRowNumber: rowIndex + 2 },
      })),
    };

    const context = buildProviderContext({
      source,
      report,
      history: [],
      question: "Что известно про Moscow?",
    });

    expect(
      new TextEncoder().encode(JSON.stringify(context)).byteLength,
    ).toBeLessThanOrEqual(CHAT_CONTEXT_MAX_SERIALIZED_BYTES);
    expect(context.retrieval).toMatchObject({
      matchedSources: 5_000,
      truncated: true,
    });
    expect(context.retrieval.includedSources).toBeGreaterThan(0);
    expect(context.retrieval.includedSources).toBeLessThan(5_000);
  });

  it("keeps useful cells from a matched row even when one cell is oversized", () => {
    const source: Dataset = {
      version: 1,
      id: "oversized-cell",
      source: { kind: "csv" },
      columns: [
        { id: "customer", label: "Customer", scalarType: "string" },
        { id: "revenue", label: "Revenue", scalarType: "number" },
        { id: "notes", label: "Notes", scalarType: "string" },
      ],
      rows: [
        {
          id: "large",
          values: {
            customer: "Target customer",
            revenue: 42,
            notes: "x".repeat(CHAT_CONTEXT_MAX_SERIALIZED_BYTES),
          },
          provenance: { sourceRowNumber: 2 },
        },
        {
          id: "small",
          values: { customer: "Target backup", revenue: 24, notes: "ok" },
          provenance: { sourceRowNumber: 3 },
        },
      ],
    };

    const context = buildProviderContext({
      source,
      report,
      history: [],
      question: "What is the revenue for Target customer?",
    });

    expect(context.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cell-0-0" }),
        expect.objectContaining({ id: "cell-0-1" }),
      ]),
    );
    expect(context.claims).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "cell-0-2" })]),
    );
    expect(context.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cell-1-0" }),
        expect.objectContaining({ id: "cell-1-1" }),
      ]),
    );
    expect(
      new TextEncoder().encode(JSON.stringify(context)).byteLength,
    ).toBeLessThanOrEqual(CHAT_CONTEXT_MAX_SERIALIZED_BYTES);
  });

  it("prioritizes an explicit question match over common history matches", () => {
    const source: Dataset = {
      version: 1,
      id: "history-priority",
      source: { kind: "csv" },
      columns: [
        { id: "region", label: "Region", scalarType: "string" },
        { id: "value", label: "Value", scalarType: "number" },
      ],
      rows: [
        ...Array.from({ length: 4_499 }, (_, index) => ({
          id: `moscow-${index}`,
          values: { region: "Moscow", value: index },
          provenance: { sourceRowNumber: index + 2 },
        })),
        {
          id: "alpha",
          values: { region: "Alpha Unique", value: 9_999 },
          provenance: { sourceRowNumber: 4_501 },
        },
      ],
    };

    const context = buildProviderContext({
      source,
      report,
      history: [{ role: "assistant", content: "Region: Moscow." }],
      question: "Что известно про Alpha Unique?",
    });

    expect(context.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cell-4499-0" }),
        expect.objectContaining({ id: "cell-4499-1" }),
      ]),
    );
    expect(context.retrieval.decisiveSourceId).toBe("row-4499");
  });
});
