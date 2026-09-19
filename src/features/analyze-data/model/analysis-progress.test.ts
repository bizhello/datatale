import { describe, expect, it } from "vitest";
import {
  ANALYSIS_PROGRESS_CONFIG,
  estimateAnalysisProgress,
  getAnalysisProgressSchedule,
  nextAnalysisProgressDelay,
} from "./analysis-progress";

describe("estimated analysis progress", () => {
  it("uses exact uneven checkpoints and never exceeds the estimate cap", () => {
    const duration = ANALYSIS_PROGRESS_CONFIG.table.estimateMs;
    const schedule = getAnalysisProgressSchedule("table");
    const values = schedule.map(({ value }) => value);

    expect(values).toEqual([
      0, 5, 11, 19, 30, 42, 54, 65, 74, 81, 87, 91, 93, 95,
    ]);
    expect(schedule.map(({ atMs }) => atMs)).toEqual([
      0, 770, 1760, 3080, 4840, 6820, 9240, 11880, 14300, 16500, 18260, 19800,
      20900, 22000,
    ]);
    expect(estimateAnalysisProgress(0, "table")).toBe(0);
    expect(estimateAnalysisProgress(769, "table")).toBe(0);
    expect(estimateAnalysisProgress(770, "table")).toBe(5);
    expect(estimateAnalysisProgress(duration - 1, "table")).toBeLessThan(95);
    expect(estimateAnalysisProgress(duration, "table")).toBe(95);
    expect(estimateAnalysisProgress(duration * 3, "table")).toBe(95);
    expect(nextAnalysisProgressDelay(770, "table")).toBe(990);
    expect(nextAnalysisProgressDelay(duration, "table")).toBeUndefined();
  });

  it("uses the shorter provisional baseline for text", () => {
    expect(
      estimateAnalysisProgress(
        ANALYSIS_PROGRESS_CONFIG.text.estimateMs,
        "text",
      ),
    ).toBe(95);
    expect(
      estimateAnalysisProgress(
        ANALYSIS_PROGRESS_CONFIG.text.estimateMs,
        "table",
      ),
    ).toBeLessThan(95);
  });
});
