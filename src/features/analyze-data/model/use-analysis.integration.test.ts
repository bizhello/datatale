import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { useAnalysis } from "./use-analysis";

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
  ],
  metrics: [
    {
      id: "count",
      label: "Count",
      value: 1,
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
  it("bootstraps the guest before analysis and sends one stable key", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(Response.json({ report }));
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

  it("synchronously clears a completed report when the accepted source changes", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => key });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(Response.json({ report }));
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
