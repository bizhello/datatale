import { describe, expect, it } from "vitest";
import { analysisReducer, initialAnalysisState } from "./analysis-state";
import { responseError } from "./use-analysis";

describe("analysis request lifecycle", () => {
  it("rejects a late response from an earlier request", () => {
    const first = analysisReducer(initialAnalysisState, {
      type: "start",
      requestId: 1,
      idempotencyKey: "one",
    });
    const second = analysisReducer(first, {
      type: "start",
      requestId: 2,
      idempotencyKey: "two",
    });
    expect(analysisReducer(second, { type: "cancel", requestId: 1 })).toBe(
      second,
    );
  });

  it("preserves a retry key only for a safe retry", () => {
    const active = analysisReducer(initialAnalysisState, {
      type: "start",
      requestId: 1,
      idempotencyKey: "one",
    });
    expect(
      analysisReducer(active, {
        type: "error",
        requestId: 1,
        error: "timeout",
        retryable: true,
        retryKey: "one",
      }),
    ).toMatchObject({ status: "error", retryKey: "one" });
  });

  it("advances only after the observable guest bootstrap completes", () => {
    const active = analysisReducer(initialAnalysisState, {
      type: "start",
      requestId: 1,
      idempotencyKey: "one",
    });
    expect(active).toMatchObject({
      status: "analyzing",
      phase: "session-setup",
    });
    expect(
      analysisReducer(active, {
        type: "session-setup-complete",
        requestId: 1,
      }),
    ).toMatchObject({ status: "analyzing", phase: "processing" });
    expect(
      analysisReducer(active, {
        type: "session-setup-complete",
        requestId: 2,
      }),
    ).toBe(active);
  });

  it("reuses a key only for safe recovery and blocks indeterminate retry", () => {
    expect(responseError(undefined)).toEqual({
      code: "network",
      retry: "same",
    });
    expect(
      responseError(new Response(null, { status: 409 }), {
        code: "in-flight",
      }),
    ).toEqual({ code: "in-flight", retry: "same" });
    expect(
      responseError(new Response(null, { status: 409 }), {
        code: "indeterminate",
      }),
    ).toEqual({ code: "indeterminate", retry: "none" });
    expect(
      responseError(new Response(null, { status: 502 }), { code: "provider" }),
    ).toEqual({ code: "provider", retry: "new" });
  });

  it.each(["workspace", "ip", "code", "global"] as const)(
    "preserves the %s quota scope",
    (scope) => {
      expect(
        responseError(new Response(null, { status: 429 }), {
          code: "quota",
          scope,
        }),
      ).toEqual({ code: "quota", retry: "none", quotaScope: scope });
    },
  );
});
