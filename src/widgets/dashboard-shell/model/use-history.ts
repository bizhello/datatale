"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type HistoryDetail,
  type HistorySummary,
  historyDetailSchema,
  historyListSchema,
  restoreMessages,
} from "./history";

type HistoryState = Readonly<{
  analyses: HistorySummary[];
  selected: HistoryDetail | undefined;
  loading: boolean;
  error: boolean;
  opening: boolean;
  openError: boolean;
  retryId: string | undefined;
}>;

const initialState: HistoryState = {
  analyses: [],
  selected: undefined,
  loading: true,
  error: false,
  opening: false,
  openError: false,
  retryId: undefined,
};

export function useHistory() {
  const [state, setState] = useState<HistoryState>(initialState);
  const generation = useRef(0);
  const listController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);

  const invalidate = useCallback((clearHistory: boolean) => {
    generation.current += 1;
    listController.current?.abort();
    detailController.current?.abort();
    listController.current = undefined;
    detailController.current = undefined;
    if (!mounted.current) return;
    setState((current) => ({
      ...current,
      ...(clearHistory ? { analyses: [], error: false } : {}),
      selected: undefined,
      loading: false,
      opening: false,
      openError: false,
      retryId: undefined,
    }));
  }, []);

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current;
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    setState((current) => ({ ...current, loading: true, error: false }));
    try {
      const response = await fetch("/api/saved-analysis", {
        method: "GET",
        signal: controller.signal,
      });
      if (requestGeneration !== generation.current || !mounted.current) return;
      if (response.status === 401) {
        setState((current) => ({
          ...current,
          analyses: [],
          loading: false,
          error: false,
        }));
        return;
      }
      if (!response.ok) throw new Error("History unavailable");
      const value = (await response.json()) as { analyses?: unknown };
      const parsed = historyListSchema.safeParse(value.analyses);
      if (!parsed.success) throw new Error("Invalid history");
      if (requestGeneration !== generation.current || !mounted.current) return;
      setState((current) => ({
        ...current,
        analyses: parsed.data,
        loading: false,
        error: false,
      }));
    } catch {
      if (
        controller.signal.aborted ||
        requestGeneration !== generation.current ||
        !mounted.current
      )
        return;
      setState((current) => ({ ...current, loading: false, error: true }));
    }
  }, []);

  const open = useCallback(async (id: string) => {
    const requestGeneration = ++generation.current;
    listController.current?.abort();
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setState((current) => ({
      ...current,
      opening: true,
      openError: false,
      retryId: id,
      selected: undefined,
    }));
    try {
      const response = await fetch(`/api/saved-analysis/${id}`, {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("History item unavailable");
      const parsed = historyDetailSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Invalid history item");
      if (requestGeneration !== generation.current || !mounted.current) return;
      setState((current) => ({
        ...current,
        selected: {
          ...parsed.data,
          messages: restoreMessages(parsed.data.messages),
        },
        opening: false,
        openError: false,
      }));
    } catch {
      if (
        controller.signal.aborted ||
        requestGeneration !== generation.current ||
        !mounted.current
      )
        return;
      setState((current) => ({
        ...current,
        opening: false,
        openError: true,
      }));
    }
  }, []);

  const sourceReady = useCallback(() => invalidate(false), [invalidate]);
  const deleteAll = useCallback(() => invalidate(true), [invalidate]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current += 1;
      listController.current?.abort();
      detailController.current?.abort();
    };
  }, [load]);

  return {
    ...state,
    load,
    open,
    sourceReady,
    deleteAll,
  };
}
