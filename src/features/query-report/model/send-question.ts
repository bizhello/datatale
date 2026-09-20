import { chatResultSchema } from "@/entities/chat";
import {
  AskDataClientError,
  type AskDataResult,
  type AskDataSend,
} from "./types";

type ErrorPayload = { code?: unknown; scope?: unknown };

function requestError(response: Response, payload: ErrorPayload) {
  const code = typeof payload.code === "string" ? payload.code : "unknown";
  const quotaScope =
    payload.scope === "workspace" || payload.scope === "unlocked-workspace"
      ? payload.scope
      : undefined;
  const retryable =
    (response.status >= 500 &&
      code !== "timeout" &&
      code !== "invalid-answer") ||
    code === "in-flight";
  return new AskDataClientError(code, {
    code,
    retryable,
    ...(quotaScope ? { quotaScope } : {}),
  });
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
    if (result.data.outcome === "not_in_source")
      return { status: "insufficient_data" };
    if (result.data.outcome === "clarification")
      return { status: "unsupported_operation", message: result.data.message };
    return {
      status: "unsupported_operation",
      message: result.data.message,
    };
  };
}
