import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "grounded-flow-acceptance.spec.ts",
  // Each flow includes analysis plus several live AI questions; individual waits allow 180s.
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL:
      process.env.DATATALE_ACCEPTANCE_BASE_URL ?? "https://datatale.bizhov.ru",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
