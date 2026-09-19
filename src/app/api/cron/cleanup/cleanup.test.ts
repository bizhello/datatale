import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredData } from "./cleanup";

describe("scheduled data cleanup", () => {
  it("cleans both run-gate state and seven-day saved analyses", async () => {
    const cleanupRuns = vi.fn(async () => 3);
    const cleanupAnalyses = vi.fn(async () => 2);
    await expect(
      cleanupExpiredData(cleanupRuns, cleanupAnalyses),
    ).resolves.toBe(5);
    expect(cleanupRuns).toHaveBeenCalledOnce();
    expect(cleanupAnalyses).toHaveBeenCalledOnce();
  });
});
