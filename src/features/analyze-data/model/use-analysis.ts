"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import { z } from "zod";
import type { Dataset, TextSource } from "@/entities/dataset";
import { finalReportSchema } from "@/entities/report";
import {
  ANALYSIS_PROGRESS_CONFIG,
  estimateAnalysisProgress,
  nextAnalysisProgressDelay,
} from "./analysis-progress";
import {
  type AnalysisErrorCode,
  analysisReducer,
  initialAnalysisState,
  type QuotaScope,
} from "./analysis-state";

type AnalyzeResponse = {
  analysisId?: unknown;
  expiresAt?: unknown;
  report?: unknown;
  code?: unknown;
  scope?: unknown;
};

export type RestoredAnalysis = Readonly<{
  analysisId: string;
  expiresAt: string;
  report: import("@/entities/report").FinalReport;
}>;

function initialState(restored?: RestoredAnalysis) {
  return restored
    ? ({ status: "ready", ...restored } as const)
    : initialAnalysisState;
}

type RetryMode = "same" | "new" | "none";

export function responseError(
  response: Response | undefined,
  value?: AnalyzeResponse,
): { code: AnalysisErrorCode; retry: RetryMode; quotaScope?: QuotaScope } {
  if (!response) return { code: "network", retry: "same" };
  if (response.status === 429 || value?.code === "quota") {
    const quotaScope =
      value?.scope === "workspace" ||
      value?.scope === "ip" ||
      value?.scope === "code" ||
      value?.scope === "global"
        ? value.scope
        : undefined;
    return {
      code: "quota",
      retry: "none",
      ...(quotaScope ? { quotaScope } : {}),
    };
  }
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

export function useAnalysis(
  source: Dataset | TextSource,
  restored?: RestoredAnalysis,
) {
  const [state, dispatch] = useReducer(analysisReducer, restored, initialState);
  const nextRequestId = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const completionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const currentSource = useRef(source);

  const clearTimers = useCallback(() => {
    if (progressTimer.current !== undefined)
      clearTimeout(progressTimer.current);
    if (completionTimer.current !== undefined)
      clearTimeout(completionTimer.current);
    progressTimer.current = undefined;
    completionTimer.current = undefined;
  }, []);

  useLayoutEffect(() => {
    if (currentSource.current === source) return;
    currentSource.current = source;
    nextRequestId.current += 1;
    controller.current?.abort();
    clearTimers();
    controller.current = undefined;
    dispatch({ type: "reset" });
  }, [clearTimers, source]);

  const run = useCallback(
    async (reuseKey?: string) => {
      controller.current?.abort();
      clearTimers();
      const requestId = ++nextRequestId.current;
      const key = reuseKey ?? idempotencyKey();
      const abortController = new AbortController();
      controller.current = abortController;
      const ownsRequest = () =>
        controller.current === abortController &&
        nextRequestId.current === requestId;
      const clearOwnedTimers = () => {
        if (ownsRequest()) clearTimers();
      };
      dispatch({ type: "start", requestId, idempotencyKey: key });
      const sourceKind = source.source.kind === "text" ? "text" : "table";
      const startedAt = Date.now();
      const tick = () => {
        if (!ownsRequest() || abortController.signal.aborted) return;
        const progress = estimateAnalysisProgress(
          Date.now() - startedAt,
          sourceKind,
        );
        dispatch({ type: "progress", requestId, value: progress });
        const delay = nextAnalysisProgressDelay(
          Date.now() - startedAt,
          sourceKind,
        );
        if (delay !== undefined && ownsRequest())
          progressTimer.current = setTimeout(tick, delay);
      };
      const firstDelay = nextAnalysisProgressDelay(0, sourceKind);
      if (firstDelay !== undefined)
        progressTimer.current = setTimeout(tick, firstDelay);
      try {
        const bootstrap = await fetch("/api/guest", {
          method: "POST",
          signal: abortController.signal,
        });
        if (!bootstrap.ok) {
          const value: AnalyzeResponse = await bootstrap
            .json()
            .catch(() => ({}));
          if (!ownsRequest()) return;
          const mapped = responseError(bootstrap, value);
          clearOwnedTimers();
          if (abortController.signal.aborted) {
            dispatch({ type: "cancel", requestId });
            return;
          }
          dispatch({
            type: "error",
            requestId,
            error: mapped.code,
            retryable: mapped.retry !== "none",
            ...(mapped.retry === "same" ? { retryKey: key } : {}),
            ...(mapped.quotaScope ? { quotaScope: mapped.quotaScope } : {}),
          });
          return;
        }
        if (!ownsRequest()) return;
        dispatch({ type: "session-setup-complete", requestId });
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
        if (!ownsRequest()) return;
        if (abortController.signal.aborted) {
          clearOwnedTimers();
          dispatch({ type: "cancel", requestId });
          return;
        }
        if (!response.ok) {
          const mapped = responseError(response, value);
          clearOwnedTimers();
          dispatch({
            type: "error",
            requestId,
            error: mapped.code,
            retryable: mapped.retry !== "none",
            ...(mapped.retry === "same" ? { retryKey: key } : {}),
            ...(mapped.quotaScope ? { quotaScope: mapped.quotaScope } : {}),
          });
          return;
        }
        const parsed = finalReportSchema.safeParse(value.report);
        const analysisId = z.string().uuid().safeParse(value.analysisId);
        const expiresAt = z.string().datetime().safeParse(value.expiresAt);
        if (!parsed.success || !analysisId.success || !expiresAt.success) {
          clearOwnedTimers();
          dispatch({
            type: "error",
            requestId,
            error: "invalid-report",
            retryable: true,
          });
          return;
        }
        if (!ownsRequest()) return;
        clearOwnedTimers();
        dispatch({
          type: "complete",
          requestId,
          analysisId: analysisId.data,
          expiresAt: expiresAt.data,
          report: parsed.data,
        });
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            if (ownsRequest() && completionTimer.current !== undefined)
              clearTimeout(completionTimer.current);
            if (ownsRequest()) completionTimer.current = undefined;
            abortController.signal.removeEventListener("abort", onAbort);
            resolve();
          };
          const onAbort = () => finish();
          abortController.signal.addEventListener("abort", onAbort);
          completionTimer.current = setTimeout(
            finish,
            ANALYSIS_PROGRESS_CONFIG.completionDelayMs,
          );
        });
        if (!ownsRequest()) return;
        if (abortController.signal.aborted) {
          clearOwnedTimers();
          dispatch({ type: "cancel", requestId });
          return;
        }
        dispatch({
          type: "ready",
          requestId,
          analysisId: analysisId.data,
          expiresAt: expiresAt.data,
          report: parsed.data,
        });
      } catch (_error) {
        if (!ownsRequest()) return;
        clearOwnedTimers();
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
    [clearTimers, source],
  );

  const cancel = useCallback(() => {
    clearTimers();
    controller.current?.abort();
  }, [clearTimers]);
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
      clearTimers();
      controller.current?.abort();
    },
    [clearTimers],
  );
  return { state, run, cancel, retry };
}
