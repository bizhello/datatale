import { z } from "zod";
import { chatResultSchema } from "@/entities/chat";
import {
  type Dataset,
  datasetSchema,
  type TextSource,
  textSourceSchema,
} from "@/entities/dataset";
import { finalReportSchema } from "@/entities/report";
import type { AskDataMessage } from "@/features/query-report";

export const historyListSchema = z.array(
  z
    .object({
      id: z.string().uuid(),
      sourceKind: z.enum(["dataset", "text"]),
      createdAt: z.string().datetime(),
      expiresAt: z.string().datetime(),
    })
    .strict(),
);

const persistedMessageSchema = z
  .object({
    id: z.string().min(1),
    analysisId: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
    result: chatResultSchema.optional(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((message, context) => {
    if (
      (message.role === "assistant" && message.result === undefined) ||
      (message.role === "user" && message.result !== undefined)
    )
      context.addIssue({
        code: "custom",
        message: "Assistant history requires a validated result.",
        path: ["result"],
      });
  });

export const historyDetailSchema = z
  .object({
    analysisId: z.string().uuid(),
    source: z.union([datasetSchema, textSourceSchema]),
    report: finalReportSchema,
    expiresAt: z.string().datetime(),
    messages: z.array(persistedMessageSchema),
  })
  .strict();

export type HistorySummary = z.infer<typeof historyListSchema>[number];
export type HistoryDetail = {
  analysisId: string;
  source: Dataset | TextSource;
  report: z.infer<typeof finalReportSchema>;
  expiresAt: string;
  messages: AskDataMessage[];
};

export function restoreMessages(
  messages: z.infer<typeof persistedMessageSchema>[],
): AskDataMessage[] {
  return messages.flatMap((message) => {
    const user: AskDataMessage = {
      id: `${message.id}:user`,
      messageId: message.id,
      role: message.role,
      text: message.content,
    };
    if (message.role === "user") return [user];
    if (!message.result) return [user];
    const result = message.result;
    const assistant: AskDataMessage =
      result.outcome === "answered"
        ? {
            id: `${message.id}:assistant`,
            role: "assistant",
            text: result.answer,
            kind: "answer",
            evidenceLabels: result.references.map(
              (reference, index) =>
                reference.excerpt ?? `Источник ${index + 1}`,
            ),
          }
        : result.outcome === "not_in_source"
          ? {
              id: `${message.id}:assistant`,
              role: "assistant",
              text: "В этом отчете нет такой информации",
              kind: "insufficient",
            }
          : {
              id: `${message.id}:assistant`,
              role: "assistant",
              text: result.message,
              kind: "unsupported",
            };
    return [assistant];
  });
}
