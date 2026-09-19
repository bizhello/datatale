export const ONBOARDING_VERSION = "1";
export const ONBOARDING_STORAGE_KEY = `datatale:onboarding:v${ONBOARDING_VERSION}`;

export type OnboardingPreference = "completed" | "skipped";

export function readOnboardingPreference(): OnboardingPreference | undefined {
  try {
    const value = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return value === "completed" || value === "skipped" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeOnboardingPreference(value: OnboardingPreference) {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, value);
  } catch {
    // Preferences are optional and storage can be disabled by the browser.
  }
}
