import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const preferenceKey = "datatale:onboarding:v1";

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(
    ({ key, marker, preserveOnReload }) => {
      if (!preserveOnReload || !window.sessionStorage.getItem(marker)) {
        window.localStorage.removeItem(key);
        window.sessionStorage.setItem(marker, "true");
      }
    },
    {
      key: preferenceKey,
      marker: `onboarding-test:${testInfo.title}`,
      preserveOnReload: testInfo.title.includes("Done completes"),
    },
  );
});

test("shows the welcome, mounts stable demo targets, and restores focus after skip", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".page-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const welcome = page.getByRole("dialog", {
    name: "Добро пожаловать в DataTale",
  });
  await expect(welcome).toHaveCount(1);
  await expect(welcome).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      localStorage.setItem("theme", value);
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    await page.waitForTimeout(100);
    const results = await new AxeBuilder({ page })
      .include(".onboarding-welcome")
      .analyze();
    expect(
      results.violations.filter(({ id }) => id === "color-contrast"),
    ).toEqual([]);
  }
  await expect(page.locator(".page-shell")).toHaveAttribute("inert", "");
  await page.mouse.click(10, 700);
  await expect(welcome).toBeVisible();
  const replay = page.getByRole("button", {
    name: "Открыть знакомство с DataTale",
  });
  await page.getByRole("button", { name: "Начать знакомство" }).click();
  await expect(page.locator(".onboarding-demo-workspace")).toBeVisible();
  await expect(
    page.locator(".onboarding-demo-workspace .chart-heading button").first(),
  ).toBeVisible();
  await expect(
    page.locator(".onboarding-demo-workspace [data-onboarding-ask]"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пропустить" }).last().click();
  await expect(page.locator(".onboarding-demo-workspace")).toHaveCount(0);
  await expect(replay).toBeFocused();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
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
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
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

test("Done completes onboarding and suppresses the welcome after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать знакомство" }).click();
  const next = page.locator(".driver-popover-next-btn");
  const done = page.locator(".driver-popover-done-btn");
  for (let step = 0; step < 10 && !(await done.isVisible()); step += 1)
    await next.click();
  await expect(done).toBeVisible();
  await done.click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe("completed");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Добро пожаловать в DataTale" }),
  ).toHaveCount(0);
});

test("replay restores a populated source and report after dismissal", async ({
  page,
}) => {
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({ json: { expiresAt: "2026-10-19T00:00:00.000Z" } });
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      json: {
        analysisId: "00000000-0000-4000-8000-000000000009",
        report: {
          version: 1,
          hero: [
            {
              text: "Стабильный отчёт",
              factIds: ["revenue"],
              evidenceIds: ["rows"],
              kind: "observation",
            },
          ],
          metrics: [
            {
              id: "revenue",
              label: "Выручка",
              value: 10,
              evidenceIds: ["rows"],
            },
          ],
          charts: [],
          noChartReason: "Недостаточно категорий для диаграммы.",
          evidence: [{ id: "rows", kind: "row-range", label: "Все строки" }],
          recommendations: [],
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Продолжить к анализу" }).click();
  await page.getByRole("button", { name: "Запустить анализ" }).click();
  await expect(
    page.getByRole("heading", { name: "Стабильный отчёт" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть знакомство с DataTale" })
    .click();
  await expect(page.locator(".onboarding-demo-workspace")).toBeVisible();
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
  const demoReport = page.locator(
    ".onboarding-demo-workspace .report-dashboard",
  );
  const labelledBy = await demoReport.getAttribute("aria-labelledby");
  expect(labelledBy).toBeTruthy();
  await expect(page.locator(`[id="${labelledBy}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Пропустить" }).last().click();
  await expect(page.locator(".onboarding-demo-workspace")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Стабильный отчёт" }),
  ).toBeVisible();
  await expect(page.getByText("Таблица готова к анализу")).toBeVisible();
});
