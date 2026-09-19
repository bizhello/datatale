"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AskDataClientError,
  type AskDataMessage,
  type AskDataResult,
  type AskDataSend,
  MAX_QUESTION_LENGTH,
} from "./types";

type AskDataState = {
  messages: AskDataMessage[];
  question: string;
  pending: boolean;
  error: string | null;
  retryQuestion: string | null;
  retryMessageId: string | null;
};

const initialState: AskDataState = {
  messages: [],
  question: "",
  pending: false,
  error: null,
  retryQuestion: null,
  retryMessageId: null,
};

function createId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (!cryptoApi?.getRandomValues) {
    throw new AskDataClientError("Безопасный идентификатор недоступен.", {
      retryable: false,
    });
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes.at(6) ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes.at(8) ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function errorMessage(error: unknown) {
  if (error instanceof AskDataClientError && !error.retryable) {
    return "Не удалось получить ответ. Попробуйте сформулировать вопрос иначе.";
  }
  return "Не удалось получить ответ. Проверьте соединение и попробуйте ещё раз.";
}

function resultMessage(
  result: AskDataResult,
): Omit<AskDataMessage, "id" | "role"> {
  if (result.status === "answered") {
    const answer: Omit<AskDataMessage, "id" | "role"> = {
      text: result.answer,
      kind: "answer",
    };
    if (result.evidenceLabels) answer.evidenceLabels = result.evidenceLabels;
    return answer;
  }
  if (result.status === "insufficient_data") {
    return { text: "В этом отчете нет такой информации", kind: "insufficient" };
  }
  return { text: result.message, kind: "unsupported" };
}

export function useAskData(send: AskDataSend) {
  const [state, setState] = useState(initialState);
  const requestRef = useRef<{ controller: AbortController; id: number } | null>(
    null,
  );
  const nextRequestId = useRef(0);

  const setQuestion = useCallback((question: string) => {
    setState((current) => ({ ...current, question, error: null }));
  }, []);

  const cancel = useCallback(() => {
    const request = requestRef.current;
    if (!request) return;
    request.controller.abort();
    requestRef.current = null;
    setState((current) => ({ ...current, pending: false }));
  }, []);

  const submit = useCallback(
    async (rawQuestion?: string, retryMessageId?: string) => {
      const question = (rawQuestion ?? state.question).trim();
      if (
        !question ||
        question.length > MAX_QUESTION_LENGTH ||
        requestRef.current
      ) {
        return false;
      }

      const requestId = ++nextRequestId.current;
      const messageId = retryMessageId ?? createId();
      const controller = new AbortController();
      requestRef.current = { controller, id: requestId };
      setState((current) => ({
        ...current,
        question: "",
        pending: true,
        error: null,
        retryQuestion: null,
        retryMessageId: null,
        messages: retryMessageId
          ? current.messages
          : [
              ...current.messages,
              { id: createId(), messageId, role: "user", text: question },
            ],
      }));

      try {
        const result = await send({ messageId, question }, controller.signal);
        if (requestRef.current?.id !== requestId) return false;
        setState((current) => ({
          ...current,
          pending: false,
          messages: [
            ...current.messages,
            { id: createId(), role: "assistant", ...resultMessage(result) },
          ],
        }));
        requestRef.current = null;
        return true;
      } catch (error) {
        if (controller.signal.aborted || requestRef.current?.id !== requestId) {
          return false;
        }
        requestRef.current = null;
        setState((current) => ({
          ...current,
          pending: false,
          error: errorMessage(error),
          retryQuestion: question,
          retryMessageId: messageId,
        }));
        return false;
      }
    },
    [send, state.question],
  );

  useEffect(() => cancel, [cancel]);

  return { ...state, setQuestion, submit, cancel };
}
