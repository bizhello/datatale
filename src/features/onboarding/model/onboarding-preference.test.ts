import { beforeEach, describe, expect, it } from "vitest";
import {
  ONBOARDING_STORAGE_KEY,
  readOnboardingPreference,
  writeOnboardingPreference,
} from "./onboarding-preference";

describe("onboarding preference", () => {
  beforeEach(() => window.localStorage.clear());

  it("does not show a preference before first visit", () => {
    expect(readOnboardingPreference()).toBeUndefined();
  });

  it("persists completion and skip states in the versioned key", () => {
    writeOnboardingPreference("skipped");
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("skipped");
    expect(readOnboardingPreference()).toBe("skipped");

    writeOnboardingPreference("completed");
    expect(readOnboardingPreference()).toBe("completed");
  });

  it("ignores unknown versions or values", () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "unknown");
    expect(readOnboardingPreference()).toBeUndefined();
  });
});
