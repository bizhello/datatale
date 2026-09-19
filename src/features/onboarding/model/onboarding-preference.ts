export const ONBOARDING_VERSION = "1";
export const ONBOARDING_STORAGE_KEY = `datatale:onboarding:v${ONBOARDING_VERSION}`;

export type OnboardingPreference = "completed" | "skipped";

let memoryPreference: OnboardingPreference | undefined;

export function readOnboardingPreference(): OnboardingPreference | undefined {
  try {
    const value = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (value === "completed" || value === "skipped") {
      memoryPreference = value;
      return value;
    }
    return undefined;
  } catch {
    return memoryPreference;
  }
}

export function writeOnboardingPreference(value: OnboardingPreference) {
  memoryPreference = value;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, value);
  } catch {
    // Preferences are optional and storage can be disabled by the browser.
  }
}
