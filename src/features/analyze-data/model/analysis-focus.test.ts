import { describe, expect, it } from "vitest";
import {
  ANALYSIS_FOCUS_MAX_LENGTH,
  analysisFocusSchema,
  normalizeAnalysisFocus,
} from "./analysis-focus";

describe("analysis focus", () => {
  it("trims the boundary and treats blank input as absent", () => {
    expect(normalizeAnalysisFocus("  compare regions  ")).toBe(
      "compare regions",
    );
    expect(normalizeAnalysisFocus("   ")).toBeUndefined();
  });

  it("preserves intentional internal whitespace", () => {
    expect(normalizeAnalysisFocus("a  useful\nquestion")).toBe(
      "a  useful\nquestion",
    );
  });

  it("enforces the bounded preference contract", () => {
    expect(
      analysisFocusSchema.safeParse("x".repeat(ANALYSIS_FOCUS_MAX_LENGTH))
        .success,
    ).toBe(true);
    expect(
      analysisFocusSchema.safeParse("x".repeat(ANALYSIS_FOCUS_MAX_LENGTH + 1))
        .success,
    ).toBe(false);
  });
});
