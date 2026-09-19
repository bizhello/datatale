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
});
