import { z } from "zod";

export const CHAT_QUESTION_MAX_LENGTH = 1_000;
export const CHAT_ANSWER_MAX_LENGTH = 1_200;
export const CHAT_HISTORY_MAX_MESSAGES = 12;
export const CHAT_HISTORY_MESSAGE_MAX_LENGTH = 1_000;
export const CHAT_REFERENCE_MAX_COUNT = 7;
export const CHAT_REFUSAL = "В этом отчете нет такой информации";

const boundedText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0, "Text must not be blank.");

export const chatQuestionSchema = boundedText(CHAT_QUESTION_MAX_LENGTH);
export const chatRequestSchema = z
  .object({
    analysisId: z.string().uuid(),
    messageId: z.string().uuid(),
    question: chatQuestionSchema,
  })
  .strict();

export const chatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: boundedText(CHAT_HISTORY_MESSAGE_MAX_LENGTH),
  })
  .strict();

export const chatReferenceSchema = z
  .object({
    id: boundedText(160),
    excerpt: z.string().max(1_000).optional(),
  })
  .strict();

export const chatAnswerSchema = z
  .object({
    outcome: z.literal("answered"),
    answer: boundedText(CHAT_ANSWER_MAX_LENGTH),
    references: z
      .array(chatReferenceSchema)
      .min(1)
      .max(CHAT_REFERENCE_MAX_COUNT),
  })
  .strict();

export const chatResultSchema = z.discriminatedUnion("outcome", [
  chatAnswerSchema,
  z
    .object({
      outcome: z.literal("not_in_source"),
      message: z.literal(CHAT_REFUSAL),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("clarification"),
      message: boundedText(CHAT_ANSWER_MAX_LENGTH),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("unsupported_operation"),
      message: boundedText(CHAT_ANSWER_MAX_LENGTH),
    })
    .strict(),
]);

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatReference = z.infer<typeof chatReferenceSchema>;
export type ChatAnswer = z.infer<typeof chatAnswerSchema>;
export type ChatResult = z.infer<typeof chatResultSchema>;
