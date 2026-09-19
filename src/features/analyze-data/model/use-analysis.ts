"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { finalReportSchema } from "@/entities/report";
import {
  type AnalysisErrorCode,
  analysisReducer,
  initialAnalysisState,
} from "./analysis-state";

type AnalyzeResponse = { report?: unknown; code?: unknown };

function errorCode(
  response: Response | undefined,
  value?: AnalyzeResponse,
): AnalysisErrorCode {
  if (!response) return "network";
  if (response.status === 429 || value?.code === "quota") return "quota";
  if (response.status === 408 || value?.code === "timeout") return "timeout";
  if (value?.code === "unavailable") return "unavailable";
  if (value?.code === "configuration") return "configuration";
  if (value?.code === "duplicate") return "duplicate";
  if (value?.code === "provider") return "provider";
  return "unknown";
}

function idempotencyKey() {
  return crypto.randomUUID();
}

export function useAnalysis(source: Dataset | TextSource) {
  const [state, dispatch] = useReducer(analysisReducer, initialAnalysisState);
  const nextRequestId = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);

  const run = useCallback(
    async (reuseKey?: string) => {
      controller.current?.abort();
      const requestId = ++nextRequestId.current;
      const key = reuseKey ?? idempotencyKey();
      const abortController = new AbortController();
      controller.current = abortController;
      dispatch({ type: "start", requestId, idempotencyKey: key });
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({ source }),
          signal: abortController.signal,
        });
        const value: AnalyzeResponse = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code = errorCode(response, value);
          dispatch({
            type: "error",
            requestId,
            error: code,
            ...(code === "network" || code === "timeout" || code === "provider"
              ? { retryKey: key }
              : {}),
          });
          return;
        }
        const parsed = finalReportSchema.safeParse(value.report);
        if (!parsed.success) {
          dispatch({ type: "error", requestId, error: "invalid-report" });
          return;
        }
        dispatch({ type: "ready", requestId, report: parsed.data });
      } catch (_error) {
        if (abortController.signal.aborted) {
          dispatch({ type: "cancel", requestId });
          return;
        }
        dispatch({ type: "error", requestId, error: "network", retryKey: key });
      }
    },
    [source],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const retry = useCallback(() => {
    if (state.status === "error") void run(state.retryKey);
    else void run();
  }, [run, state]);
  useEffect(() => () => controller.current?.abort(), []);
  return { state, run, cancel, retry };
}
