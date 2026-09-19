import { z } from "zod";

export const ANALYSIS_FOCUS_MAX_LENGTH = 400;
export const analysisFocusSchema = z
  .string()
  .max(ANALYSIS_FOCUS_MAX_LENGTH)
  .transform((value) => value.trim())
  .transform((value) => (value.length > 0 ? value : undefined));
export type AnalysisFocus = z.output<typeof analysisFocusSchema>;
export function normalizeAnalysisFocus(value: unknown): AnalysisFocus {
  return analysisFocusSchema.parse(value ?? "");
}
