import type { Dataset } from "../model/schema";
import type { TextSource } from "../model/text-source";

export function sourceDisplaySummary(source: Dataset | TextSource) {
  if ("rawText" in source)
    return {
      name: "Текстовый источник",
      detail: `${source.paragraphs.length.toLocaleString("ru-RU")} абз. · ${source.rawText.length.toLocaleString("ru-RU")} символов`,
    };
  return {
    name: source.source.filename ?? "Табличный источник",
    detail: `${source.rows.length.toLocaleString("ru-RU")} строк · ${source.columns.length} столбцов`,
  };
}
