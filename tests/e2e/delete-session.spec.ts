import { expect, type Page, test } from "@playwright/test";

const report = {
  version: 1,
  hero: [
    {
      text: "Проверенный отчёт остаётся видимым до успешного удаления.",
      factIds: ["count"],
    },
  ],
  metrics: [
    {
      id: "count",
      label: "Строки",
      value: 3,
      evidenceIds: ["rows"],
    },
  ],
  charts: [],
  evidence: [{ id: "rows", kind: "row-range", label: "Все строки" }],
  recommendations: [],
  noChartReason: "Для проверки удаления график не требуется.",
};

async function openAnalysis(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Продолжить к анализу" }).click();
}

test("delete-all calls the private guest endpoint once and clears local state after success", async ({
  page,
}) => {
  let deleteCalls = 0;
  await page.route("**/api/guest", async (route) => {
    if (route.request().method() === "DELETE") {
      deleteCalls += 1;
      await route.fulfill({
        status: 204,
        headers: { "Cache-Control": "private, no-store" },
      });
      return;
    }
    await route.fulfill({
      json: { expiresAt: "2026-10-19T00:00:00.000Z" },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await openAnalysis(page);
  await page
    .getByRole("button", { name: "Удалить все данные этого сеанса" })
    .click();
  await expect(
    page.getByRole("button", { name: "Загрузить синтетический демо-набор" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Запустить анализ" }),
  ).toHaveCount(0);
  expect(deleteCalls).toBe(1);
});

test("failed delete-all keeps the report visible and exposes an actionable retry", async ({
  page,
}) => {
  let deleteCalls = 0;
  await page.route("**/api/guest", async (route) => {
    if (route.request().method() === "DELETE") {
      deleteCalls += 1;
      await route.fulfill({
        status: 503,
        json: { code: "unavailable" },
        headers: { "Cache-Control": "private, no-store" },
      });
      return;
    }
    await route.fulfill({
      json: { expiresAt: "2026-10-19T00:00:00.000Z" },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({ json: { report } });
  });
  await openAnalysis(page);
  await page.getByRole("button", { name: "Запустить анализ" }).click();
  const reportHeading = page.getByRole("heading", {
    name: /Проверенный отчёт остаётся видимым/,
  });
  await expect(reportHeading).toBeVisible();
  await page
    .getByRole("button", { name: "Удалить все данные этого сеанса" })
    .click();
  await expect(page.getByText("Не удалось удалить данные")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить удаление" }),
  ).toBeVisible();
  await expect(reportHeading).toBeVisible();
  expect(deleteCalls).toBe(1);
});
