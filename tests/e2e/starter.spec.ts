import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createMultiSheetXlsx } from "../fixtures/import/xlsx";

const dashboardReport = {
  version: 1,
  hero: [
    {
      text: "Выручка выросла в феврале, а каналы заметно различаются.",
      factIds: ["revenue"],
    },
  ],
  metrics: [
    {
      id: "revenue",
      label: "Выручка",
      value: 274000,
      unit: "₽",
      evidenceIds: ["rows"],
    },
  ],
  charts: [
    {
      id: "bar",
      kind: "bar",
      title: "По регионам",
      rationale: "Сравнение регионов",
      points: [
        { label: "Север", value: 120000 },
        { label: "Юг", value: 154000 },
      ],
      evidenceIds: ["rows"],
    },
    {
      id: "line",
      kind: "line",
      title: "По месяцам",
      rationale: "Динамика",
      points: [
        { label: "Январь", value: 128000 },
        { label: "Февраль", value: 146000 },
      ],
      evidenceIds: ["rows"],
    },
    {
      id: "donut",
      kind: "donut",
      title: "По каналам",
      rationale: "Доля каналов",
      points: [
        { label: "Онлайн", value: 174000 },
        { label: "Офлайн", value: 100000 },
      ],
      evidenceIds: ["rows"],
    },
  ],
  evidence: [{ id: "rows", kind: "row-range", label: "Все строки источника" }],
  recommendations: [
    { text: "Проверьте рост онлайн-канала.", factIds: ["revenue"] },
  ],
};

function xlsxWithInvalidFirstSheet() {
  const archive = unzipSync(createMultiSheetXlsx());
  archive["xl/worksheets/sheet1.xml"] = strToU8(
    '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1"/><sheetData/></worksheet>',
  );
  return zipSync(archive);
}

test("accepts text locally and exposes an honest preview", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const text = page.getByLabel("Текст отчёта");
  await text.fill("Первый абзац.\n\nВторой абзац.");
  await expect(text).toHaveValue("Первый абзац.\n\nВторой абзац.");
  await page.getByRole("button", { name: "Проверить текст" }).click();
  await expect(page.getByText("Текст готов к анализу")).toBeVisible();
  await expect(
    page.getByText("Полный проверенный источник будет передан AI-провайдеру."),
  ).toBeVisible();
});

test("renders a fixture dashboard and expands charts without another analysis request", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/api/guest", async (route) => {
    requests.push("guest");
    await route.fulfill({
      json: { expiresAt: "2026-10-19T00:00:00.000Z" },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await page.route("**/api/analyze", async (route) => {
    requests.push("analyze");
    await route.fulfill({ json: { report: dashboardReport } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Продолжить к анализу" }).click();
  await page.getByRole("button", { name: "Запустить анализ" }).click();
  await expect(
    page.getByRole("heading", { name: /Выручка выросла/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Развернуть По регионам" }),
  ).toBeVisible();
  const chartCards = page.locator(".chart-card");
  const evidence = page.locator(".evidence");
  const evidenceBox = await evidence.boundingBox();
  if (!evidenceBox) throw new Error("Evidence bounds are unavailable.");
  for (let index = 0; index < (await chartCards.count()); index += 1) {
    const card = chartCards.nth(index);
    const [cardBox, tableBox] = await Promise.all([
      card.boundingBox(),
      card.locator("table").boundingBox(),
    ]);
    if (!cardBox || !tableBox)
      throw new Error(`Chart ${index + 1} bounds are unavailable.`);
    expect(tableBox.y + tableBox.height).toBeLessThanOrEqual(
      cardBox.y + cardBox.height + 1,
    );
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(evidenceBox.y + 1);
  }
  await expect(page.getByText("Действие", { exact: true })).toBeVisible();
  await expect(page.getByText("Наблюдение", { exact: true })).toHaveCount(0);
  const expandButton = page.getByRole("button", {
    name: "Развернуть По регионам",
  });
  await expandButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(expandButton).toBeFocused();
  expect(requests).toEqual(["guest", "analyze"]);
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

test("opens the file chooser from the visible upload button", async ({
  page,
}) => {
  await page.goto("/");
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Выбрать файл" }).click();
  await (await fileChooser).setFiles({
    name: "button-upload.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Месяц,Выручка\nЯнварь,128000"),
  });
  await expect(
    page.getByRole("heading", { name: "button-upload.csv" }),
  ).toBeVisible();
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
