import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHistory } from "./use-history";

const analysisId = "00000000-0000-4000-8000-000000000002";
const secondId = "00000000-0000-4000-8000-000000000003";
const report = {
  version: 1 as const,
  hero: [
    {
      text: "Observed",
      factIds: [],
      evidenceIds: ["e"],
      kind: "observation" as const,
    },
    {
      text: "Confirmed",
      factIds: [],
      evidenceIds: ["e"],
      kind: "observation" as const,
    },
  ],
  metrics: [],
  charts: [],
  evidence: [
    { id: "e", kind: "quote" as const, label: "Source", excerpt: "One" },
  ],
  recommendations: [],
  noChartReason: "No chart is needed.",
};
const source = {
  version: 1 as const,
  id: "text-1",
  source: { kind: "text" as const },
  rawText: "One",
  paragraphs: [{ index: 1, text: "One" }],
};

function detail(id: string) {
  return {
    analysisId: id,
    source,
    report,
    expiresAt: "2026-09-26T12:00:00.000Z",
    messages: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("useHistory request lifecycle", () => {
  it("accepts the active response under StrictMode effect replay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          analyses: [
            {
              id: analysisId,
              sourceKind: "text",
              createdAt: "2026-09-19T12:00:00.000Z",
              expiresAt: "2026-09-26T12:00:00.000Z",
            },
          ],
        }),
      ),
    );
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, undefined, children);
    const { result } = renderHook(() => useHistory(), { wrapper });
    await waitFor(() => expect(result.current.analyses).toHaveLength(1));
  });

  it("allows a failed list load to be retried", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ analyses: [] }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.error).toBe(true));
    await act(async () => result.current.load());
    await waitFor(() => expect(result.current.error).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("clears selected access and notifies the shell after a list 401", async () => {
    const onAccessLost = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ analyses: [] }))
      .mockResolvedValueOnce(Response.json(detail(analysisId)))
      .mockResolvedValueOnce(
        Response.json({ code: "expired" }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useHistory({ onAccessLost }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.open(analysisId));
    await waitFor(() =>
      expect(result.current.selected?.analysisId).toBe(analysisId),
    );
    await act(async () => result.current.load());
    await waitFor(() => expect(result.current.selected).toBeUndefined());
    expect(onAccessLost).toHaveBeenCalledOnce();
  });

  it("keeps report A visible when opening report B fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ analyses: [] }))
      .mockResolvedValueOnce(Response.json(detail(analysisId)))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.open(analysisId));
    await waitFor(() =>
      expect(result.current.selected?.analysisId).toBe(analysisId),
    );
    await act(async () => result.current.open(secondId));
    await waitFor(() => expect(result.current.openError).toBe(true));
    expect(result.current.selected?.analysisId).toBe(analysisId);
  });

  it("clears report A and notifies the shell when opening B gets a 401", async () => {
    const onAccessLost = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ analyses: [] }))
      .mockResolvedValueOnce(Response.json(detail(analysisId)))
      .mockResolvedValueOnce(
        Response.json({ code: "expired" }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useHistory({ onAccessLost }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.open(analysisId));
    await waitFor(() =>
      expect(result.current.selected?.analysisId).toBe(analysisId),
    );
    await act(async () => result.current.open(secondId));
    await waitFor(() => expect(result.current.selected).toBeUndefined());
    expect(result.current.analyses).toEqual([]);
    expect(onAccessLost).toHaveBeenCalledOnce();
  });

  it("does not repopulate after delete invalidates a deferred list", async () => {
    let resolveList!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (resolveList = resolve))),
    );
    const { result } = renderHook(() => useHistory());
    act(() => result.current.deleteAll());
    await act(async () => {
      resolveList(
        Response.json({
          analyses: [
            {
              id: analysisId,
              sourceKind: "text",
              createdAt: "2026-09-19T12:00:00.000Z",
              expiresAt: "2026-09-26T12:00:00.000Z",
            },
          ],
        }),
      );
    });
    expect(result.current.analyses).toEqual([]);
  });

  it("does not restore a deferred detail after delete", async () => {
    let resolveDetail!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        String(input) === "/api/saved-analysis"
          ? Promise.resolve(Response.json({ analyses: [] }))
          : new Promise<Response>((resolve) => (resolveDetail = resolve)),
      ),
    );
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => void result.current.open(analysisId));
    act(() => result.current.deleteAll());
    await act(async () => resolveDetail(Response.json(detail(analysisId))));
    expect(result.current.selected).toBeUndefined();
  });

  it("keeps the newest open and ignores source replacement and stale detail", async () => {
    const requests = new Map<string, (response: Response) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/saved-analysis")
          return Promise.resolve(Response.json({ analyses: [] }));
        return new Promise<Response>((resolve) => requests.set(url, resolve));
      }),
    );
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => void result.current.open(analysisId));
    act(() => void result.current.open(secondId));
    await act(async () => {
      requests.get(`/api/saved-analysis/${analysisId}`)?.(
        Response.json(detail(analysisId)),
      );
    });
    expect(result.current.selected).toBeUndefined();
    await act(async () => {
      requests.get(`/api/saved-analysis/${secondId}`)?.(
        Response.json(detail(secondId)),
      );
    });
    expect(result.current.selected?.analysisId).toBe(secondId);
    act(() => result.current.sourceReady());
    act(() => void result.current.open(analysisId));
    act(() => result.current.sourceReady());
    await act(async () => {
      requests.get(`/api/saved-analysis/${analysisId}`)?.(
        Response.json(detail(secondId)),
      );
    });
    expect(result.current.selected).toBeUndefined();
  });
});
