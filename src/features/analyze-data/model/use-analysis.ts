"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { finalReportSchema } from "@/entities/report";
import {
  type AnalysisErrorCode,
  analysisReducer,
  initialAnalysisState,
} from "./analysis-state";

type AnalyzeResponse = { report?: unknown; code?: unknown };

type RetryMode = "same" | "new" | "none";

export function responseError(
  response: Response | undefined,
  value?: AnalyzeResponse,
): { code: AnalysisErrorCode; retry: RetryMode } {
  if (!response) return { code: "network", retry: "same" };
  if (response.status === 429 || value?.code === "quota")
    return { code: "quota", retry: "none" };
  if (value?.code === "timeout") return { code: "timeout", retry: "none" };
  if (value?.code === "unavailable")
    return { code: "unavailable", retry: "same" };
  if (value?.code === "configuration")
    return { code: "configuration", retry: "none" };
  if (value?.code === "conflict") return { code: "conflict", retry: "new" };
  if (value?.code === "in-flight") return { code: "in-flight", retry: "same" };
  if (value?.code === "indeterminate")
    return { code: "indeterminate", retry: "none" };
  if (value?.code === "expired") return { code: "expired", retry: "same" };
  if (value?.code === "invalid-source")
    return { code: "invalid-source", retry: "none" };
  if (value?.code === "invalid-report")
    return { code: "invalid-report", retry: "new" };
  if (value?.code === "provider") return { code: "provider", retry: "new" };
  return { code: "unknown", retry: "new" };
}

function idempotencyKey() {
  return crypto.randomUUID();
}

export function useAnalysis(source: Dataset | TextSource) {
  const [state, dispatch] = useReducer(analysisReducer, initialAnalysisState);
  const nextRequestId = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const currentSource = useRef(source);

  useLayoutEffect(() => {
    if (currentSource.current === source) return;
    currentSource.current = source;
    nextRequestId.current += 1;
    controller.current?.abort();
    controller.current = undefined;
    dispatch({ type: "reset" });
  }, [source]);

  const run = useCallback(
    async (reuseKey?: string) => {
      controller.current?.abort();
      const requestId = ++nextRequestId.current;
      const key = reuseKey ?? idempotencyKey();
      const abortController = new AbortController();
      controller.current = abortController;
      dispatch({ type: "start", requestId, idempotencyKey: key });
      try {
        const bootstrap = await fetch("/api/guest", {
          method: "POST",
          signal: abortController.signal,
        });
        if (!bootstrap.ok) {
          const value: AnalyzeResponse = await bootstrap
            .json()
            .catch(() => ({}));
          const mapped = responseError(bootstrap, value);
          dispatch({
            type: "error",
            requestId,
            error: mapped.code,
            retryable: mapped.retry !== "none",
            ...(mapped.retry === "same" ? { retryKey: key } : {}),
          });
          return;
        }
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
          const mapped = responseError(response, value);
          dispatch({
            type: "error",
            requestId,
            error: mapped.code,
            retryable: mapped.retry !== "none",
            ...(mapped.retry === "same" ? { retryKey: key } : {}),
          });
          return;
        }
        const parsed = finalReportSchema.safeParse(value.report);
        if (!parsed.success) {
          dispatch({
            type: "error",
            requestId,
            error: "invalid-report",
            retryable: true,
          });
          return;
        }
        dispatch({ type: "ready", requestId, report: parsed.data });
      } catch (_error) {
        if (abortController.signal.aborted) {
          dispatch({ type: "cancel", requestId });
          return;
        }
        dispatch({
          type: "error",
          requestId,
          error: "network",
          retryable: true,
          retryKey: key,
        });
      }
    },
    [source],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const retry = useCallback(() => {
    if (state.status === "error") {
      if (state.retryable) void run(state.retryKey);
      return;
    }
    void run();
  }, [run, state]);
  useEffect(
    () => () => {
      nextRequestId.current += 1;
      controller.current?.abort();
    },
    [],
  );
  return { state, run, cancel, retry };
}
