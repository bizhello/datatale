import type { HistorySummary } from "./history";

export function historyLabel(analysis: HistorySummary) {
  const date = new Date(analysis.createdAt).toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${analysis.sourceKind === "dataset" ? "Таблица" : "Текстовый отчёт"} · ${date} · ${analysis.id.slice(-6)}`;
}
