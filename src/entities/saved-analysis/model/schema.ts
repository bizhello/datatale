import { z } from "zod";
import { inputLimits } from "@/shared/config";

export const SAVED_ANALYSIS_TTL_MS = 30 * 24 * 60 * 60_000;
export const SAVED_ANALYSIS_SOURCE_MAX_BYTES = inputLimits.canonicalSourceBytes;
export const SAVED_ANALYSIS_MESSAGE_MAX_LENGTH = 12_000;
export const SAVED_ANALYSIS_MESSAGE_ID_MAX_LENGTH = 160;
export const SAVED_ANALYSIS_HISTORY_MAX_MESSAGES = 100;

export type StorageSchema<T> = Readonly<{ parse(input: unknown): T }>;
export type SavedAnalysisValidators<
  Source = unknown,
  Report = unknown,
> = Readonly<{
  source: StorageSchema<Source>;
  report: StorageSchema<Report>;
}>;
export const savedMessageInputSchema = z
  .object({
    id: z.string().min(1).max(SAVED_ANALYSIS_MESSAGE_ID_MAX_LENGTH),
    role: z.enum(["user", "assistant"]),
    content: z
      .string()
      .min(1)
      .max(SAVED_ANALYSIS_MESSAGE_MAX_LENGTH)
      .refine((value) => value.trim().length > 0, {
        message: "Message must contain a non-whitespace character.",
      }),
  })
  .strict();

export const savedAnalysisSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    source: z.unknown(),
    report: z.unknown(),
    createdAt: z.date(),
    lastAccessedAt: z.date(),
    expiresAt: z.date(),
  })
  .strict();

export const savedAnalysisMessageSchema = z
  .object({
    id: z.string().min(1),
    analysisId: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
    createdAt: z.date(),
  })
  .strict();

export type AcceptedSource = unknown;
export type SavedMessageInput = z.infer<typeof savedMessageInputSchema>;
export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>;
export type SavedAnalysisMessage = z.infer<typeof savedAnalysisMessageSchema>;

export function sourceKind(source: unknown): "dataset" | "text" {
  return typeof source === "object" && source !== null && "rawText" in source
    ? "text"
    : "dataset";
}

export function assertStoragePayloads(
  source: unknown,
  report: unknown,
  validators: SavedAnalysisValidators,
): { source: unknown; report: unknown } {
  const parsedSource = validators.source.parse(source);
  const bytes = new TextEncoder().encode(
    JSON.stringify(parsedSource),
  ).byteLength;
  if (bytes > SAVED_ANALYSIS_SOURCE_MAX_BYTES)
    throw new Error("Saved analysis source exceeds the size limit.");
  return { source: parsedSource, report: validators.report.parse(report) };
}
