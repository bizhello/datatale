import { describe, expect, it } from "vitest";
import type { Dataset } from "@/entities/dataset";
import { chartCopy, metricLabel } from "./report-copy";

const source: Dataset = {
  version: 1,
  id: "copy",
  source: { kind: "csv" },
  columns: [
    { id: "month", label: "Месяц", scalarType: "string" },
    { id: "revenue", label: "Выручка", scalarType: "number" },
  ],
  rows: [],
};

describe("report display copy", () => {
  it("builds deterministic Russian metric and chart copy from checked fields", () => {
    const aggregation = { kind: "sum" as const, field: { fieldId: "revenue" } };

    expect(metricLabel(source, aggregation)).toBe("Сумма: Выручка");
    expect(
      chartCopy(source, {
        id: "revenue-by-month",
        kind: "bar",
        title: "Provider title",
        rationale: "Provider rationale",
        dimension: { fieldId: "month" },
        aggregation,
        categoryLimit: 12,
      }),
    ).toEqual({
      title: "Сравнение по полю «Месяц»: сумма «Выручка»",
      rationale:
        "Столбчатая диаграмма наглядно сравнивает значения между категориями.",
    });
  });
});
