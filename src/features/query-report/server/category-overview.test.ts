import { describe, expect, it } from "vitest";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { categoryOverview } from "./category-overview";

const report: FinalReport = {
  version: 1,
  hero: [
    {
      text: "Проверенный вывод.",
      factIds: ["rows"],
      evidenceIds: ["all"],
      kind: "observation",
    },
    {
      text: "Источник проверен.",
      factIds: [],
      evidenceIds: ["all"],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "rows",
      label: "Строки",
      value: 3,
      calculation: { kind: "count" },
      evidenceIds: ["all"],
    },
  ],
  charts: [],
  evidence: [
    {
      id: "all",
      kind: "row-range",
      label: "Все строки",
      coverage: { included: 3, total: 3 },
    },
  ],
  recommendations: [],
  noChartReason: "График не требуется.",
};

function dataset(
  rows: Array<Record<string, string | number | boolean>>,
): Dataset {
  return {
    version: 1,
    id: "cities",
    source: { kind: "xlsx", sheet: "Продажи" },
    columns: [
      { id: "city", label: "Город", scalarType: "string" },
      { id: "note", label: "Метка", scalarType: "string" },
      { id: "sales", label: "Продажи", scalarType: "number" },
    ],
    rows: rows.map((values, index) => ({
      id: `row-${index}`,
      values,
      provenance: { sourceRowNumber: index + 2 },
    })),
  };
}

describe("broad category overview", () => {
  it("ignores low-information values while matching an inflected city", () => {
    const source = dataset([
      { city: "Краснодар", note: "по", sales: 10 },
      { city: "Краснодар", note: "по", sales: 20 },
      { city: "Москва", note: "по", sales: 30 },
    ]);

    expect(
      categoryOverview("Дай информацию по Краснодару", source, report),
    ).toMatchObject({
      outcome: "answered",
      answer: "В поле «Город» значение «Краснодар» встречается в 2 строках.",
      references: [{ id: "evidence-0" }],
    });
  });

  it("does not select a field when the same value is ambiguous", () => {
    const source = dataset([
      { city: "Краснодар", note: "Краснодар", sales: 10 },
      { city: "Москва", note: "Другое", sales: 20 },
      { city: "Самара", note: "Ещё", sales: 30 },
    ]);

    expect(
      categoryOverview("Покажи информацию по Краснодару", source, report),
    ).toBeUndefined();
  });

  it("uses row references when complete report evidence is unavailable", () => {
    const source = dataset([
      { city: "Краснодар", note: "Юг", sales: 10 },
      { city: "Москва", note: "Центр", sales: 20 },
      { city: "Самара", note: "Волга", sales: 30 },
    ]);
    const partialReport: FinalReport = {
      ...report,
      evidence: [
        {
          id: "partial",
          kind: "row-range",
          label: "Часть строк",
          coverage: { included: 2, total: 3 },
        },
      ],
      hero: report.hero.map((item) => ({
        ...item,
        factIds: [],
        evidenceIds: ["partial"],
      })),
      metrics: [],
    };

    expect(
      categoryOverview("Расскажи про Краснодар", source, partialReport),
    ).toEqual({
      outcome: "answered",
      answer: "В поле «Город» значение «Краснодар» встречается в 1 строке.",
      references: [{ id: "row-0" }],
    });
  });

  it("returns no shortcut for a category absent from the source", () => {
    const source = dataset([
      { city: "Краснодар", note: "Юг", sales: 10 },
      { city: "Москва", note: "Центр", sales: 20 },
      { city: "Самара", note: "Волга", sales: 30 },
    ]);

    expect(
      categoryOverview("Дай информацию по Казани", source, report),
    ).toBeUndefined();
  });

  it.each([
    "Покажи информацию по Краснодару за 2025 год",
    "Покажи информацию не по Краснодару",
    "Сравни информацию по Краснодару и Москве",
    "Перечисли все данные по Краснодару",
    "Покажи информацию по Краснодару в январе",
    "Покажи строки по Краснодару",
    "Покажи информацию по Краснодару с продажами выше среднего",
  ])("does not ignore an additional constraint in: %s", (question) => {
    const source = dataset([
      { city: "Краснодар", note: "Юг", sales: 10 },
      { city: "Москва", note: "Центр", sales: 20 },
      { city: "Самара", note: "Волга", sales: 30 },
    ]);

    expect(categoryOverview(question, source, report)).toBeUndefined();
  });
});
