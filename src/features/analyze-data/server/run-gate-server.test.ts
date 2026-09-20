import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getRunGateConfig } from "./run-gate-server";

afterEach(() => vi.unstubAllEnvs());

describe("analysis run-gate configuration", () => {
  it("uses the canonical workspace tiers and environment abuse ceilings", () => {
    vi.stubEnv("ANALYSIS_IP_DAILY_LIMIT", "40");
    vi.stubEnv("ANALYSIS_GLOBAL_DAILY_LIMIT", "200");
    expect(getRunGateConfig()).toEqual({
      freeWorkspaceDailyLimit: 5,
      unlockedWorkspaceDailyLimit: 20,
      ipDailyLimit: 40,
      globalDailyLimit: 200,
    });
  });
});
