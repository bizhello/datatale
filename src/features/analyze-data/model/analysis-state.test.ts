import { describe, expect, it } from "vitest";
import { analysisReducer, initialAnalysisState } from "./analysis-state";

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
        retryKey: "one",
      }),
    ).toMatchObject({ status: "error", retryKey: "one" });
  });
});
