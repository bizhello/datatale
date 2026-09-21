import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const fixtureDirectory = path.join(process.cwd(), "tests/manual/fixtures");
const canonicalAbsence = "В этом отчете нет такой информации";
const accessCode = process.env.DATATALE_ACCEPTANCE_ACCESS_CODE;

type Question = { prompt: string; expected: string };

function fixture(name: string) {
  return path.join(fixtureDirectory, name);
}

async function unlockIfNeeded(page: Page) {
  const dialog = page.getByRole("dialog");
  if (!(await dialog.isVisible().catch(() => false))) return;
  if (!accessCode)
    throw new Error(
      "The production access modal is visible. Set DATATALE_ACCEPTANCE_ACCESS_CODE.",
    );
  await dialog.getByLabel("Код доступа").fill(accessCode);
  await dialog.getByRole("button", { name: /Продолжить/ }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

async function waitForReport(page: Page) {
  await unlockIfNeeded(page);
  await expect(page.locator("[data-analysis-report-heading]")).toBeVisible({
    timeout: 180_000,
  });
  await expect(page.locator(".analysis-workspace [role=alert]")).toHaveCount(0);
}

async function uploadAndAnalyze(page: Page, fileName: string) {
  await page.goto("/");
  await page
    .locator('input[aria-label="Выбрать CSV или XLSX файл"]')
    .setInputFiles(fixture(fileName));
  await expect(page.locator(".preview")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await waitForReport(page);
}

async function pasteAndAnalyze(page: Page, fileName: string) {
  await page.goto("/");
  const text = await readFile(fixture(fileName), "utf8");
  await page.locator("#source-text").fill(text);
  await page.getByRole("button", { name: "Проверить текст" }).click();
  await expect(page.getByText("Текст готов к анализу")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await waitForReport(page);
}

async function ask(page: Page, question: Question) {
  const input = page.locator('textarea[name="ask-data-question"]');
  await input.fill(question.prompt);
  await page.getByRole("button", { name: "Спросить" }).click();
  await unlockIfNeeded(page);
  const log = page.getByRole("log", { name: "История вопросов и ответов" });
  await expect(log).toContainText(question.expected, { timeout: 90_000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("datatale:onboarding:v1", "skipped");
  });
  const diagnostics: string[] = [];
  const recordDiagnostic = (message: string) => {
    diagnostics.push(message);
    console.error(`[manual acceptance] ${message}`);
  };
  page.on("pageerror", (error) =>
    recordDiagnostic(`pageerror: ${error.message}`),
  );
  page.on("requestfailed", (request) =>
    recordDiagnostic(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`,
    ),
  );
  page.on("response", (response) => {
    if (response.status() >= 500)
      recordDiagnostic(`HTTP ${response.status()}: ${response.url()}`);
  });
});

test("runs the CSV grounded flow and rejects an absent named entity", async ({
  page,
}) => {
  await uploadAndAnalyze(page, "regional-sales.csv");
  await expect(page.locator(".chart-card").first()).toBeVisible();
  await ask(page, { prompt: "Какая общая выручка?", expected: "1 743 000" });
  await ask(page, {
    prompt: "Какая выручка у Краснодара?",
    expected: "569 000",
  });
  await ask(page, {
    prompt: "В каком месяце выручка была максимальной?",
    expected: "478 000",
  });
  await ask(page, {
    prompt: "Какая выручка у Владивостока?",
    expected: canonicalAbsence,
  });
});

test("runs quoted CSV and multi-sheet XLSX sources", async ({ page }) => {
  await uploadAndAnalyze(page, "quoted-products.csv");
  await ask(page, {
    prompt: "Сколько единиц товара продано всего?",
    expected: "175",
  });
  await ask(page, { prompt: "Сколько продано напитков?", expected: "59" });
  await ask(page, {
    prompt: "Есть ли молочные продукты?",
    expected: canonicalAbsence,
  });

  await page.getByRole("button", { name: "Создать новый отчёт" }).click();
  await uploadAndAnalyze(page, "operations-multisheet.xlsx");
  await ask(page, {
    prompt: "Какая общая выручка в продажах?",
    expected: "672 000",
  });

  await page.getByRole("button", { name: "Создать новый отчёт" }).click();
  await page.goto("/");
  await page
    .locator('input[aria-label="Выбрать CSV или XLSX файл"]')
    .setInputFiles(fixture("operations-multisheet.xlsx"));
  await expect(page.locator(".preview")).toBeVisible({ timeout: 30_000 });
  const sheetSelect = page.locator(".sheet-select");
  await sheetSelect.getByRole("button").click();
  await page.getByRole("option", { name: "Поддержка" }).click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await waitForReport(page);
  await ask(page, { prompt: "Сколько обращений поступило?", expected: "500" });
  await ask(page, {
    prompt: "Сколько обращений у команды Гамма?",
    expected: canonicalAbsence,
  });
});

test("runs the monthly aggregation and zero-count flow", async ({ page }) => {
  await uploadAndAnalyze(page, "monthly-buckets.csv");
  await expect(page.locator(".chart-card").first()).toBeVisible();
  await ask(page, {
    prompt: "Какая выручка была в январе 2026 года?",
    expected: "120",
  });
  await ask(page, {
    prompt: "Какая выручка была в феврале 2026 года?",
    expected: "100",
  });
  await ask(page, {
    prompt: "Какая себестоимость была в январе 2026 года?",
    expected: "120",
  });
  await ask(page, {
    prompt: "Сколько заказов было в марте 2026 года?",
    expected: "0",
  });

  await page.getByRole("button", { name: "Создать новый отчёт" }).click();
  await uploadAndAnalyze(page, "known-range-zero.csv");
  await ask(page, {
    prompt: "Сколько заказов было в Москве в феврале 2026 года?",
    expected: "0",
  });
  await ask(page, {
    prompt: "Есть ли в данных Новосибирск?",
    expected: canonicalAbsence,
  });
});

test("answers grounded text questions and derives a bounded total", async ({
  page,
}) => {
  await pasteAndAnalyze(page, "shuffled-dates.txt");
  await expect(page.locator(".chart-card").first()).toBeVisible();
  await ask(page, {
    prompt: "Сколько продаж было 14 сентября?",
    expected: "140",
  });
  await ask(page, {
    prompt: "Сколько продаж было 15 сентября?",
    expected: "150",
  });
  await ask(page, {
    prompt: "Сколько продаж было 16 сентября?",
    expected: "160",
  });

  await page.getByRole("button", { name: "Создать новый отчёт" }).click();
  await pasteAndAnalyze(page, "animals-without-total.txt");
  await ask(page, { prompt: "Сколько животных всего?", expected: "21" });
  await ask(page, {
    prompt: "Сколько кроликов в приюте?",
    expected: canonicalAbsence,
  });
});

test("runs the existing shelter text fixture", async ({ page }) => {
  await pasteAndAnalyze(page, "shelter-report.txt");
  await expect(page.locator(".chart-card").first()).toBeVisible();
  await ask(page, {
    prompt: "Сколько животных было к концу 17 сентября?",
    expected: "21",
  });
  await ask(page, {
    prompt: "В какой день расходы на корм были максимальными?",
    expected: "8 900",
  });
  await ask(page, {
    prompt: "Сколько кроликов в приюте?",
    expected: canonicalAbsence,
  });
});

test("preserves localized numeric evidence and rejects malformed formats", async ({
  page,
}) => {
  await pasteAndAnalyze(page, "localized-numbers.txt");
  await ask(page, {
    prompt: "Какой доход указан в отчёте?",
    expected: "1 234",
  });
  await ask(page, {
    prompt: "Какие расходы указаны в отчёте?",
    expected: "1 234",
  });
  await ask(page, {
    prompt: "Какие доходы у компании за прошлый год?",
    expected: canonicalAbsence,
  });

  await page.getByRole("button", { name: "Создать новый отчёт" }).click();
  await page
    .locator('input[aria-label="Выбрать CSV или XLSX файл"]')
    .setInputFiles(fixture("malformed.csv"));
  await expect(page.locator('[role="alert"]')).toContainText(
    /CSV|разобрать|ошиб/i,
  );
  await expect(page.locator(".preview")).toHaveCount(0);

  await page
    .locator('input[aria-label="Выбрать CSV или XLSX файл"]')
    .setInputFiles(fixture("unsupported.tsv"));
  await expect(page.locator('[role="alert"]')).toContainText(
    /формат|поддерж|TSV/i,
  );
  await expect(page.locator(".preview")).toHaveCount(0);
});
