import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("keeps a session preference when browser storage is unavailable", () => {
    const getItem = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    writeOnboardingPreference("skipped");
    expect(readOnboardingPreference()).toBe("skipped");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
