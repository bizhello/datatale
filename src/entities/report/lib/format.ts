import type { FinalReport } from "../model/schema";

const compactAxisNumber = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const regularAxisNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function formatChartAxisValue(value: number) {
  return Math.abs(value) >= 10_000
    ? compactAxisNumber.format(value)
    : regularAxisNumber.format(value);
}

export function formatExpiry(expiresAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(expiresAt));
}
export function formatDerivation(
  calculation: FinalReport["metrics"][number]["calculation"],
) {
  if (calculation.kind === "direct-source") return "Указано в исходном тексте";
  if (calculation.kind === "count") return "Количество принятых строк";
  const labels = {
    sum: "Сумма",
    average: "Среднее",
    min: "Минимум",
    max: "Максимум",
  } as const;
  return `${labels[calculation.kind]} поля «${calculation.fieldLabel}» по всем принятым строкам`;
}
export function formatChartDerivation(
  aggregation: FinalReport["charts"][number]["aggregation"],
) {
  if (aggregation.kind === "direct-source")
    return `Значения из исходного текста по полю «${aggregation.dimensionLabel}»`;
  if (aggregation.kind === "count")
    return `Количество строк по полю «${aggregation.dimensionLabel}»`;
  const labels = {
    sum: "Сумма",
    average: "Среднее",
    min: "Минимум",
    max: "Максимум",
  } as const;
  return `${labels[aggregation.kind]} поля «${aggregation.fieldLabel}» по полю «${aggregation.dimensionLabel}»`;
}
export function formatEvidenceSummary(item: FinalReport["evidence"][number]) {
  const kind = item.kind === "row-range" ? "Строки таблицы" : "Абзац источника";
  const coverage = item.coverage
    ? ` · Покрытие: ${item.coverage.included.toLocaleString("ru-RU")} из ${item.coverage.total.toLocaleString("ru-RU")}`
    : "";
  return `${kind} · ${item.label}${item.excerpt ? `: ${item.excerpt}` : ""}${coverage}`;
}
