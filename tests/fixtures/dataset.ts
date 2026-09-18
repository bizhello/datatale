import type { Dataset } from "@/entities/dataset";

export const syntheticDatasetFixture: Dataset = {
  version: 1,
  id: "dataset-sales-q1",
  source: {
    kind: "csv",
    filename: "sales-q1.csv",
  },
  columns: [
    { id: "date", label: "Date", scalarType: "date" },
    { id: "revenue", label: "Revenue", scalarType: "number", unit: "USD" },
    { id: "paid", label: "Paid", scalarType: "boolean" },
    { id: "note", label: "Note", scalarType: "string" },
  ],
  rows: [
    {
      id: "row-1",
      values: {
        date: "2026-01-31",
        revenue: 1200,
        paid: true,
        note: "January",
      },
      provenance: { sourceRowNumber: 2 },
    },
    {
      id: "row-2",
      values: {
        date: "2026-02-28",
        revenue: null,
        paid: false,
        note: "February",
      },
      provenance: { sourceRowNumber: 3 },
    },
  ],
};
