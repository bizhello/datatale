import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("accepts text locally and exposes an honest preview", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Текст отчёта").fill("Первый абзац.\n\nВторой абзац.");
  await page.getByRole("button", { name: "Проверить текст" }).click();
  await expect(page.getByText("Текст готов к анализу")).toBeVisible();
  await expect(page.getByText("Источник проверен. Анализ и сохранение отчёта появятся в следующем этапе.")).toBeVisible();
});

test("fits mobile and has no automated accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});
