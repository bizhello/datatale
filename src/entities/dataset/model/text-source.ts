import { z } from "zod";

export const textSourceSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    source: z.object({ kind: z.literal("text") }).strict(),
    rawText: z.string().min(1),
    paragraphs: z
      .array(
        z
          .object({
            index: z.number().int().positive(),
            text: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type TextSource = z.infer<typeof textSourceSchema>;
