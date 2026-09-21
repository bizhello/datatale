import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "grounded-flow-acceptance.spec.ts",
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
