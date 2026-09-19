import { chatResultSchema } from "@/entities/chat";
import {
  AskDataClientError,
  type AskDataResult,
  type AskDataSend,
} from "./types";

type ErrorPayload = { code?: unknown };

function requestError(response: Response, payload: ErrorPayload) {
  const code = typeof payload.code === "string" ? payload.code : "unknown";
  const retryable =
    response.status >= 500 && code !== "timeout" && code !== "invalid-answer";
  return new AskDataClientError(code, { code, retryable });
}

export function createAskDataSend(analysisId: string): AskDataSend {
  return async (request, signal): Promise<AskDataResult> => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, ...request }),
      signal,
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw requestError(response, payload as ErrorPayload);
    const result = chatResultSchema.safeParse(payload);
    if (!result.success)
      throw new AskDataClientError("invalid-answer", {
        code: "invalid-answer",
        retryable: false,
      });
    if (result.data.outcome === "answered")
      return {
        status: "answered",
        answer: result.data.answer,
        evidenceLabels: result.data.references.map(
          (reference, index) => reference.excerpt ?? `Источник ${index + 1}`,
        ),
      };
    if (result.data.outcome === "insufficient_data")
      return { status: "insufficient_data" };
    return {
      status: "unsupported_operation",
      message: result.data.message,
    };
  };
}
