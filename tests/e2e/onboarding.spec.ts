import { expect, test } from "@playwright/test";

const preferenceKey = "datatale:onboarding:v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (key) => window.localStorage.removeItem(key),
    preferenceKey,
  );
});

test("shows the welcome, mounts stable demo targets, and restores focus after skip", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Добро пожаловать в DataTale" }),
  ).toBeVisible();
  const replay = page.getByRole("button", {
    name: "Открыть знакомство с DataTale",
  });
  await page.getByRole("button", { name: "Начать знакомство" }).click();
  await expect(page.locator(".onboarding-demo-workspace")).toBeVisible();
  await expect(
    page.locator(".onboarding-demo-workspace .chart-heading button"),
  ).toBeVisible();
  await expect(
    page.locator(".onboarding-demo-workspace [data-onboarding-ask]"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пропустить" }).last().click();
  await expect(page.locator(".onboarding-demo-workspace")).toHaveCount(0);
  await expect(replay).toBeFocused();
  await expect(
    page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe("skipped");
});

test("Escape dismisses the tour as skipped and does not call analysis APIs", async ({
  page,
}) => {
  const analysisRequests: string[] = [];
  await page.on("request", (request) => {
    if (request.url().includes("/api/analyze"))
      analysisRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Начать знакомство" }).click();
  await expect(page.locator(".onboarding-demo-workspace")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".onboarding-demo-workspace")).toHaveCount(0);
  expect(analysisRequests).toHaveLength(0);
  await expect(
    page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe("skipped");
});

test("reduced motion keeps the welcome and replay usable on a narrow viewport", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Добро пожаловать в DataTale" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пропустить" }).click();
  await expect(
    page.getByRole("button", { name: "Открыть знакомство с DataTale" }),
  ).toBeVisible();
});

test("continues when localStorage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value: () => {
        throw new Error("blocked");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("blocked");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Добро пожаловать в DataTale" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пропустить" }).click();
  await expect(
    page.getByRole("button", { name: "Открыть знакомство с DataTale" }),
  ).toBeVisible();
});
