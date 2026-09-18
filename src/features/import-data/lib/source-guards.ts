import type { ImportResult } from "../model/types";

export function isTextSource(
  source: ImportResult["source"],
): source is Extract<ImportResult["source"], { rawText: string }> {
  return "rawText" in source;
}
