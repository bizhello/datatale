import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("starter supports keyboard disclosure and a clear demo label", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DataTale/);
  await expect(page.getByText("Пример · не AI-анализ")).toBeVisible();
  const button = page.locator('button[aria-controls="project-plan"]');
  await expect(button).toHaveAccessibleName("Посмотреть план MVP");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#project-plan")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#project-plan")).toBeHidden();
});

test("starter fits the viewport and has no automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
