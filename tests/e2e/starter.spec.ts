import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createMultiSheetXlsx } from "../fixtures/import/xlsx";

function xlsxWithInvalidFirstSheet() {
  const archive = unzipSync(createMultiSheetXlsx());
  archive["xl/worksheets/sheet1.xml"] = strToU8(
    '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1"/><sheetData/></worksheet>',
  );
  return zipSync(archive);
}

test("accepts text locally and exposes an honest preview", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Текст отчёта").fill("Первый абзац.\n\nВторой абзац.");
  await page.getByRole("button", { name: "Проверить текст" }).click();
  await expect(page.getByText("Текст готов к анализу")).toBeVisible();
  await expect(
    page.getByText(
      "Источник проверен. Анализ и сохранение отчёта появятся в следующем этапе.",
    ),
  ).toBeVisible();
});

test("uploads a CSV in the browser and labels its bounded preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Выбрать CSV или XLSX файл").setInputFiles({
    name: "revenue.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Месяц,Выручка\nЯнварь,128000\nФевраль,146000"),
  });
  await expect(
    page.getByRole("heading", { name: "revenue.csv" }),
  ).toBeVisible();
  await expect(page.getByText("Показаны первые 2 строк из 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Убрать" })).toBeVisible();
});

test("selects another sheet from an uploaded XLSX without replacing the file", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Выбрать CSV или XLSX файл").setInputFiles({
    name: "example.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(createMultiSheetXlsx()),
  });
  await expect(
    page.getByRole("heading", { name: "example.xlsx" }),
  ).toBeVisible();
  await page.getByLabel("Лист").click();
  await page.getByRole("option", { name: "Заметки" }).click();
  await expect(page.getByRole("gridcell", { name: "Готово" })).toBeVisible();
});

test("recovers from an invalid first XLSX sheet with another sheet", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Выбрать CSV или XLSX файл").setInputFiles({
    name: "recovery.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(xlsxWithInvalidFirstSheet()),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Попробовать другой лист").click();
  await page.getByRole("option", { name: "Заметки" }).click();
  await expect(page.getByRole("gridcell", { name: "Готово" })).toBeVisible();
});

test("shows an invalid upload error in the mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Выбрать CSV или XLSX файл").setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a table"),
  });
  const error = page.locator(".error-state");
  await expect(error).toBeVisible();
  const box = await error.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.y).toBeLessThan(844);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
});

test("fits mobile and has no automated accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("selects light, dark, and system themes with the keyboard", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const light = page.getByRole("radio", { name: "Светлая тема" });
  await light.focus();
  await light.press("Space");
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  const dark = page.getByRole("radio", { name: "Тёмная тема" });
  await dark.focus();
  await dark.press("Space");
  await expect(page.locator("html")).toHaveClass(/dark/);

  const system = page.getByRole("radio", { name: "Системная тема" });
  await system.focus();
  await system.press("Space");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("preserves XLSX numeric precision before canonical conversion", async ({
  page,
}) => {
  const archive = unzipSync(createMultiSheetXlsx());
  const sheet = archive["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("Expected the sales worksheet fixture.");
  archive["xl/worksheets/sheet1.xml"] = strToU8(
    strFromU8(sheet).replace(
      '<c r="B2" t="inlineStr"><is><t>12</t></is></c>',
      '<c r="B2"><v>2.000000000000000001</v></c>',
    ),
  );
  await page.goto("/");
  await page.getByLabel("Выбрать CSV или XLSX файл").setInputFiles({
    name: "precise.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(zipSync(archive)),
  });
  const warning = page.getByRole("status");
  await expect(warning).toBeVisible();
  await expect(
    warning.getByText("Предупреждение при обработке источника", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    warning.getByText(
      "Неоднозначные даты, суммы и десятичные значения сохранены как текст.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("gridcell", {
      name: "2.000000000000000001",
      exact: true,
    }),
  ).toBeVisible();
});
