import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { useAnalysis } from "./use-analysis";

const analysisId = "00000000-0000-4000-8000-000000000009";

const key = "00000000-0000-4000-8000-000000000002";
const source: Dataset = {
  version: 1,
  id: "source",
  source: { kind: "csv" },
  columns: [{ id: "value", label: "Value", scalarType: "number" }],
  rows: [
    {
      id: "row-1",
      values: { value: 1 },
      provenance: { sourceRowNumber: 2 },
    },
  ],
};
const report: FinalReport = {
  version: 1,
  hero: [
    {
      text: "Checked result.",
      factIds: ["count"],
      evidenceIds: [],
      kind: "observation",
    },
    {
      text: "The checked count is confirmed.",
      factIds: ["count"],
      evidenceIds: [],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "count",
      label: "Count",
      value: 1,
      calculation: { kind: "count" },
      evidenceIds: ["rows"],
    },
  ],
  charts: [],
  evidence: [
    {
      id: "rows",
      kind: "row-range",
      label: "All rows",
      coverage: { included: 1, total: 1 },
    },
  ],
  recommendations: [],
  noChartReason: "No chart needed.",
};

afterEach(() => vi.unstubAllGlobals());

describe("useAnalysis HTTP lifecycle", () => {
  it("rejects an analysis response without the persisted expiry", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
        .mockResolvedValueOnce(Response.json({ analysisId, report })),
    );
    const { result } = renderHook(() => useAnalysis(source));

    await act(async () => result.current.run());

    expect(result.current.state).toMatchObject({
      status: "error",
      error: "invalid-report",
    });
  });

  it("holds the approximate estimate at 95 until an early response is validated", async () => {
    vi.useFakeTimers();
    const removeAbortListener = vi.spyOn(
      AbortSignal.prototype,
      "removeEventListener",
    );
    try {
      vi.stubGlobal("crypto", { randomUUID: () => key });
      let resolveAnalysis: ((response: Response) => void) | undefined;
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveAnalysis = resolve;
            }),
        );
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(() => useAnalysis(source));
      let runPromise: Promise<void>;
      act(() => {
        runPromise = result.current.run();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => vi.advanceTimersByTime(22_000));
      expect(result.current.state).toMatchObject({
        status: "analyzing",
        progress: 95,
      });
      act(() => vi.advanceTimersByTime(10_000));
      expect(result.current.state).toMatchObject({ progress: 95 });
      resolveAnalysis?.(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.state).toMatchObject({
        status: "completing",
        progress: 100,
      });
      act(() => vi.advanceTimersByTime(320));
      await act(async () => runPromise);
      expect(result.current.state.status).toBe("ready");
      expect(removeAbortListener).toHaveBeenCalledWith(
        "abort",
        expect.any(Function),
      );
    } finally {
      removeAbortListener.mockRestore();
      vi.useRealTimers();
    }
  });

  it("removes the completion abort listener when cancellation interrupts the 100 beat", async () => {
    vi.useFakeTimers();
    const removeAbortListener = vi.spyOn(
      AbortSignal.prototype,
      "removeEventListener",
    );
    try {
      vi.stubGlobal("crypto", { randomUUID: () => key });
      let resolveAnalysis: ((response: Response) => void) | undefined;
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveAnalysis = resolve;
            }),
        );
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(() => useAnalysis(source));
      let runPromise: Promise<void>;
      act(() => {
        runPromise = result.current.run();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      resolveAnalysis?.(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.state.status).toBe("completing");
      act(() => result.current.cancel());
      await act(async () => runPromise);
      expect(result.current.state.status).toBe("cancelled");
      expect(removeAbortListener).toHaveBeenCalledWith(
        "abort",
        expect.any(Function),
      );
    } finally {
      removeAbortListener.mockRestore();
      vi.useRealTimers();
    }
  });

  it("cleans the estimate timer when an in-flight request is cancelled", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("crypto", { randomUUID: () => key });
      const fetch = vi.fn(
        (_url: string, options: { signal?: AbortSignal } | undefined) =>
          new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(() => useAnalysis(source));
      act(() => void result.current.run());
      act(() => result.current.cancel());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.state.status).toBe("cancelled");
      act(() => vi.advanceTimersByTime(30_000));
      expect(result.current.state.status).toBe("cancelled");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps request B timers alive when aborted request A settles late", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("crypto", { randomUUID: () => key });
      let resolveA: ((response: Response) => void) | undefined;
      let resolveB: ((response: Response) => void) | undefined;
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveA = resolve;
            }),
        )
        .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveB = resolve;
            }),
        );
      vi.stubGlobal("fetch", fetch);
      const { result } = renderHook(() => useAnalysis(source));
      let runA: Promise<void>;
      let runB: Promise<void>;
      act(() => {
        runA = result.current.run();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => {
        runB = result.current.run();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => vi.advanceTimersByTime(770));
      expect(result.current.state).toMatchObject({
        status: "analyzing",
        progress: 5,
      });
      resolveA?.(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
      await act(async () => runA);
      act(() => vi.advanceTimersByTime(990));
      expect(result.current.state).toMatchObject({ progress: 11 });
      resolveB?.(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.state.status).toBe("completing");
      act(() => vi.advanceTimersByTime(320));
      await act(async () => runB);
      expect(result.current.state.status).toBe("ready");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bootstraps the guest before analysis and sends one stable key", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAnalysis(source));
    await act(async () => result.current.run());
    expect(result.current.state.status).toBe("ready");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/guest",
      "/api/analyze",
    ]);
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
    });
  });

  it("sends the frozen focus on the initial request and same-key retry", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() =>
      useAnalysis(source, undefined, "compare regions"),
    );

    await act(async () => result.current.run());
    expect(result.current.state).toMatchObject({
      status: "error",
      error: "unavailable",
      retryKey: key,
    });
    await act(async () => result.current.retry());

    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      source,
      focus: "compare regions",
    });
    expect(JSON.parse(String(fetch.mock.calls[3]?.[1]?.body))).toEqual({
      source,
      focus: "compare regions",
    });
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      headers: { "Idempotency-Key": key },
    });
    expect(fetch.mock.calls[3]?.[1]).toMatchObject({
      headers: { "Idempotency-Key": key },
    });
  });

  it("does not retry an indeterminate provider-started request", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "indeterminate" }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAnalysis(source));
    await act(async () => result.current.run());
    expect(result.current.state).toMatchObject({
      status: "error",
      error: "indeterminate",
      retryable: false,
    });
    act(() => result.current.retry());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("restores a saved analysis without guest or analyze requests", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() =>
      useAnalysis(source, {
        analysisId,
        expiresAt: "2026-09-26T12:00:00.000Z",
        report,
      }),
    );
    expect(result.current.state).toMatchObject({
      status: "ready",
      analysisId,
      report,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves a terminal quota scope in client state", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
        .mockResolvedValueOnce(
          Response.json({ code: "quota", scope: "code" }, { status: 429 }),
        ),
    );
    const { result } = renderHook(() => useAnalysis(source));
    await act(async () => result.current.run());
    expect(result.current.state).toMatchObject({
      status: "error",
      error: "quota",
      quotaScope: "code",
      retryable: false,
    });
  });

  it("synchronously clears a completed report when the accepted source changes", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({
          analysisId,
          report,
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const replacement = { ...source, id: "replacement-source" };
    const { result, rerender } = renderHook(
      ({ acceptedSource }) => useAnalysis(acceptedSource),
      { initialProps: { acceptedSource: source } },
    );
    await act(async () => result.current.run());
    expect(result.current.state.status).toBe("ready");
    rerender({ acceptedSource: replacement });
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("aborts an in-flight request when the accepted source is replaced", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    let requestSignal: AbortSignal | undefined;
    const fetch = vi.fn(
      (_url: string, options: { signal?: AbortSignal } | undefined) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = options?.signal;
          requestSignal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const replacement = { ...source, id: "replacement-source" };
    const { result, rerender } = renderHook(
      ({ acceptedSource }) => useAnalysis(acceptedSource),
      { initialProps: { acceptedSource: source } },
    );
    act(() => void result.current.run());
    expect(requestSignal?.aborted).toBe(false);
    rerender({ acceptedSource: replacement });
    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("ignores a late response after the hook is unmounted", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    let resolveAnalysis: ((response: Response) => void) | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveAnalysis = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result, unmount } = renderHook(() => useAnalysis(source));
    let runPromise: Promise<void>;
    act(() => {
      runPromise = result.current.run();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
    resolveAnalysis?.(
      Response.json({
        analysisId,
        report,
        expiresAt: "2026-09-26T12:00:00.000Z",
      }),
    );
    await expect(act(async () => runPromise)).resolves.toBeUndefined();
  });

  it("clears an analysis error when the accepted source changes", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ code: "unavailable" }, { status: 503 }),
      ),
    );
    const replacement = { ...source, id: "replacement-source" };
    const { result, rerender } = renderHook(
      ({ acceptedSource }) => useAnalysis(acceptedSource),
      { initialProps: { acceptedSource: source } },
    );
    await act(async () => result.current.run());
    expect(result.current.state.status).toBe("error");
    rerender({ acceptedSource: replacement });
    expect(result.current.state).toEqual({ status: "idle" });
  });
});
