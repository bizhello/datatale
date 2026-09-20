import AxeBuilder from "@axe-core/playwright";
import { expect, type Route, test } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createMultiSheetXlsx } from "../fixtures/import/xlsx";

const analysisId = "00000000-0000-4000-8000-000000000009";
const reportExpiresAt = "2026-09-26T12:00:00.000Z";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("datatale:onboarding:v1", "skipped"),
  );
});

const dashboardReport = {
  version: 1,
  hero: [
    {
      text: "Выручка выросла в феврале, а каналы заметно различаются.",
      factIds: ["revenue"],
      evidenceIds: ["rows"],
      kind: "observation",
    },
    {
      text: "Показатели подтверждены всеми строками источника.",
      factIds: ["revenue"],
      evidenceIds: ["rows"],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "revenue",
      label: "Выручка",
      value: 274000,
      unit: "₽",
      calculation: { kind: "sum", fieldId: "revenue", fieldLabel: "Выручка" },
      evidenceIds: ["rows"],
    },
  ],
  charts: [
    {
      id: "bar",
      kind: "bar",
      title: "По регионам",
      rationale: "Сравнение регионов",
      aggregation: {
        kind: "sum",
        fieldId: "revenue",
        fieldLabel: "Выручка",
        dimensionFieldId: "region",
        dimensionLabel: "Регион",
      },
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
      aggregation: {
        kind: "sum",
        fieldId: "revenue",
        fieldLabel: "Выручка",
        dimensionFieldId: "month",
        dimensionLabel: "Месяц",
      },
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
      aggregation: {
        kind: "sum",
        fieldId: "revenue",
        fieldLabel: "Выручка",
        dimensionFieldId: "channel",
        dimensionLabel: "Канал",
      },
      points: [
        { label: "Онлайн", value: 174000 },
        { label: "Офлайн", value: 100000 },
      ],
      evidenceIds: ["rows"],
    },
  ],
  evidence: [
    {
      id: "rows",
      kind: "row-range",
      label: "Все строки источника",
      coverage: { included: 12, total: 12 },
    },
  ],
  recommendations: [
    {
      text: "Проверьте рост онлайн-канала.",
      factIds: ["revenue"],
      evidenceIds: ["rows"],
      kind: "action",
    },
  ],
};

const largeAxisDashboardReport = {
  ...dashboardReport,
  charts: [
    {
      ...dashboardReport.charts[0],
      points: [
        { label: "Самара", value: 353_185_060.81 },
        { label: "Екатеринбург", value: 350_117_433.29 },
      ],
    },
    ...dashboardReport.charts.slice(1),
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
  let historyRoute: Route | undefined;
  await page.route("**/api/saved-analysis", async (route) => {
    historyRoute = route;
  });
  await page.goto("/");
  const historyLoading = page.locator(".history-picker-loading");
  await expect(historyLoading).toBeVisible();
  const historyLoadingBounds = await historyLoading.evaluate((status) => {
    const spinner = status.querySelector<HTMLElement>('[aria-hidden="true"]');
    if (!spinner) throw new Error("History spinner is missing.");
    const statusRect = status.getBoundingClientRect();
    const spinnerRect = spinner.getBoundingClientRect();
    return {
      statusCenter: statusRect.left + statusRect.width / 2,
      contentCenter:
        (spinnerRect.left +
          (status.lastElementChild?.getBoundingClientRect().right ??
            spinnerRect.right)) /
        2,
      spinnerTop: spinnerRect.top,
      spinnerBottom: spinnerRect.bottom,
      statusTop: statusRect.top,
      statusBottom: statusRect.bottom,
    };
  });
  expect(
    Math.abs(
      historyLoadingBounds.statusCenter - historyLoadingBounds.contentCenter,
    ),
  ).toBeLessThanOrEqual(4);
  expect(historyLoadingBounds.spinnerTop).toBeGreaterThanOrEqual(
    historyLoadingBounds.statusTop,
  );
  expect(historyLoadingBounds.spinnerBottom).toBeLessThanOrEqual(
    historyLoadingBounds.statusBottom,
  );
  if (!historyRoute) throw new Error("History request was not captured.");
  await historyRoute.fulfill({
    status: 401,
    json: { code: "expired" },
  });
  await expect(page.locator(".page-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const [uploadIcon, textIcon, uploadCard, uploadAction, textCard, textAction] =
    await Promise.all([
      page.locator(".dropzone .input-icon").boundingBox(),
      page.locator(".text-input .input-icon").boundingBox(),
      page.locator(".dropzone").boundingBox(),
      page.locator(".dropzone .input-card-action button").boundingBox(),
      page.locator(".text-input").boundingBox(),
      page.locator(".text-input .input-card-action button").boundingBox(),
    ]);
  if (
    !uploadIcon ||
    !textIcon ||
    !uploadCard ||
    !uploadAction ||
    !textCard ||
    !textAction
  )
    throw new Error("Input card geometry is unavailable.");
  expect(
    Math.abs(uploadIcon.y - uploadCard.y - (textIcon.y - textCard.y)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(uploadIcon.x - uploadCard.x - (textIcon.x - textCard.x)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      uploadCard.y +
        uploadCard.height -
        (uploadAction.y + uploadAction.height) -
        (textCard.y + textCard.height - (textAction.y + textAction.height)),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      uploadCard.x +
        uploadCard.width -
        (uploadAction.x + uploadAction.width) -
        (textCard.x + textCard.width - (textAction.x + textAction.width)),
    ),
  ).toBeLessThanOrEqual(1);
  const text = page.getByLabel("Текст отчёта");
  await text.fill("Первый абзац.\n\nВторой абзац.");
  await expect(text).toHaveValue("Первый абзац.\n\nВторой абзац.");
  await page.getByRole("button", { name: "Проверить текст" }).click();
  await expect(page.getByText("Текст готов к анализу")).toBeVisible();
  await expect(
    page.getByText("Полный проверенный источник будет передан AI-провайдеру."),
  ).toBeVisible();
  await expect(page.getByText(/отчёт и чат хранятся.*7 дней/)).toBeVisible();
  await expect(page.getByText(/Сам полный источник не хранится/)).toHaveCount(
    0,
  );
  const previewSpacing = await page.locator(".preview").evaluate((preview) => {
    const header = preview.querySelector<HTMLElement>(".preview-header");
    const source = preview.querySelector<HTMLElement>(".text-preview");
    const launch = preview.querySelector<HTMLElement>(".analysis-launch-panel");
    if (!header || !source || !launch)
      throw new Error("Preview geometry is unavailable.");
    const previewBox = preview.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const sourceBox = source.getBoundingClientRect();
    const launchBox = launch.getBoundingClientRect();
    return {
      headerToSource: sourceBox.top - headerBox.bottom,
      sourceToLaunch: launchBox.top - sourceBox.bottom,
      launchTop: launchBox.top - previewBox.top,
      launchBottom: previewBox.bottom - launchBox.bottom,
    };
  });
  expect(previewSpacing.headerToSource).toBeGreaterThanOrEqual(20);
  expect(previewSpacing.sourceToLaunch).toBeGreaterThanOrEqual(20);
  expect(previewSpacing.launchTop).toBeGreaterThan(20);
  expect(previewSpacing.launchBottom).toBeGreaterThanOrEqual(20);
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
    await route.fulfill({
      json: {
        analysisId,
        report: largeAxisDashboardReport,
        expiresAt: reportExpiresAt,
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await expect(
    page.getByRole("progressbar", {
      name: "Оценка хода анализа, приблизительно",
    }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(
    page.locator(".analysis-progress-stages .is-complete"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: /Выручка выросла/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Создать новый отчёт" }),
  ).toBeVisible();
  await expect(page.getByText(/Отчёт и вопросы хранятся до/)).toBeVisible();
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
  await expect(
    chartCards.first().locator(".recharts-legend-wrapper"),
  ).toBeVisible();
  const axisGeometry = await chartCards
    .first()
    .locator(".chart-visual")
    .evaluate((visual) => {
      const visualLeft = visual.getBoundingClientRect().left;
      const ticks = [
        ...visual.querySelectorAll<SVGTextElement>(
          ".recharts-cartesian-axis-tick-value",
        ),
      ].filter((tick) => tick.getAttribute("text-anchor") === "end");
      return {
        labels: ticks.map((tick) => tick.textContent ?? ""),
        leftEdges: ticks.map((tick) => tick.getBoundingClientRect().left),
        visualLeft,
      };
    });
  expect(axisGeometry.leftEdges.length).toBeGreaterThan(0);
  for (const left of axisGeometry.leftEdges)
    expect(left).toBeGreaterThanOrEqual(axisGeometry.visualLeft);
  const expandButton = page.getByRole("button", {
    name: "Развернуть По регионам",
  });
  await expandButton.click();
  const dialog = page.getByRole("dialog").filter({
    hasText: "Основание графика",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Основание графика" }),
  ).toBeVisible();
  await expect(dialog.getByText("Все строки источника")).toBeVisible();
  const chartDialog = page.getByRole("dialog").filter({
    hasText: "Основание графика",
  });
  await page.keyboard.press("Escape");
  await expect(chartDialog).not.toBeVisible();
  await expect(expandButton).toBeFocused();
  expect(requests).toEqual(["guest", "analyze"]);
});

test("sends the optional analysis focus and keeps the compact workspace inside mobile bounds", async ({
  page,
}) => {
  let analyzeRequest: Record<string, unknown> | undefined;
  const longUnit = "оченьдлиннаяединицаизмерениябезпробеловдляпроверкипереноса";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({
      json: { expiresAt: "2026-10-19T00:00:00.000Z" },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await page.route("**/api/analyze", async (route) => {
    analyzeRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        analysisId,
        report: {
          ...dashboardReport,
          metrics: [{ ...dashboardReport.metrics[0], unit: longUnit }],
        },
        expiresAt: reportExpiresAt,
      },
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page
    .getByRole("textbox", { name: "Что вы хотите понять? (необязательно)" })
    .fill("  Сравните продажи по регионам  ");
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();

  await expect(
    page.getByRole("heading", { name: /Выручка выросла/ }),
  ).toBeVisible();
  expect(analyzeRequest).toMatchObject({
    focus: "Сравните продажи по регионам",
  });
  const workspaceBounds = await page
    .locator(".analysis-workspace")
    .evaluate((workspace) => ({
      left: workspace.getBoundingClientRect().left,
      right: workspace.getBoundingClientRect().right,
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
  expect(workspaceBounds.left).toBeGreaterThanOrEqual(0);
  expect(workspaceBounds.right).toBeLessThanOrEqual(workspaceBounds.viewport);
  expect(workspaceBounds.document).toBeLessThanOrEqual(
    workspaceBounds.viewport,
  );
  const metricBounds = await page
    .locator(".metric-value")
    .evaluate((metric) => ({
      clientWidth: metric.clientWidth,
      scrollWidth: metric.scrollWidth,
    }));
  expect(metricBounds.scrollWidth).toBeLessThanOrEqual(
    metricBounds.clientWidth,
  );
});

test("reopens a saved report and transcript without guest or AI requests", async ({
  page,
}) => {
  const requests: string[] = [];
  const savedSource = {
    version: 1,
    id: "saved-text-1",
    source: { kind: "text" },
    rawText: "Одна сохранённая строка.",
    paragraphs: [{ index: 1, text: "Одна сохранённая строка." }],
  };
  await page.route("**/api/saved-analysis", async (route) => {
    await route.fulfill({
      json: {
        analyses: [
          {
            id: analysisId,
            sourceKind: "text",
            createdAt: "2026-09-19T12:00:00.000Z",
            expiresAt: reportExpiresAt,
          },
        ],
      },
    });
  });
  await page.route(`**/api/saved-analysis/${analysisId}`, async (route) => {
    await route.fulfill({
      json: {
        analysisId,
        source: savedSource,
        report: dashboardReport,
        expiresAt: reportExpiresAt,
        messages: [
          {
            id: "question-1",
            analysisId,
            role: "user",
            content: "Какая выручка?",
            createdAt: "2026-09-19T12:01:00.000Z",
          },
          {
            id: "question-1:assistant",
            analysisId,
            role: "assistant",
            content: "Выручка: 274 000 ₽.",
            result: {
              outcome: "answered",
              answer: "Выручка: 274 000 ₽.",
              references: [{ id: "rows" }],
            },
            createdAt: "2026-09-19T12:01:01.000Z",
          },
        ],
      },
    });
  });
  for (const endpoint of ["guest", "analyze", "chat"]) {
    await page.route(`**/api/${endpoint}`, async (route) => {
      requests.push(endpoint);
      await route.abort();
    });
  }
  await page.goto("/");
  await expect(page.getByLabel("Сохранённые отчёты")).toBeVisible();
  await page.getByLabel("Сохранённые отчёты").click();
  await page.getByRole("option", { name: /Текстовый отчёт/ }).click();
  await expect(
    page.getByRole("heading", { name: /Выручка выросла/ }),
  ).toBeVisible();
  await expect(page.getByText("Какая выручка?")).toBeVisible();
  await expect(page.getByText("Выручка: 274 000 ₽.")).toBeVisible();
  expect(requests).toEqual([]);
});

test("asks a grounded question about the analyzed report", async ({ page }) => {
  let chatRequest: Record<string, unknown> | undefined;
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({
      json: { expiresAt: "2026-10-19T00:00:00.000Z" },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      json: { analysisId, report: dashboardReport, expiresAt: reportExpiresAt },
    });
  });
  await page.route("**/api/chat", async (route) => {
    chatRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        outcome: "answered",
        answer: "Выручка: 274 000 ₽.",
        references: [{ id: "evidence-0" }],
      },
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  const composer = page.getByRole("textbox", { name: "Ваш вопрос к отчёту" });
  await composer.fill("Какая выручка?");
  await composer.press("Enter");

  await expect(page.getByText("Выручка: 274 000 ₽.")).toBeVisible();
  expect(chatRequest).toMatchObject({
    analysisId,
    messageId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
    question: "Какая выручка?",
  });
});

test("unlocks chat quota and retries the preserved question once", async ({
  page,
}) => {
  const chatRequests: Array<Record<string, unknown>> = [];
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({ json: { expiresAt: "2026-10-19T00:00:00.000Z" } });
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      json: { analysisId, report: dashboardReport, expiresAt: reportExpiresAt },
    });
  });
  await page.route("**/api/chat", async (route) => {
    chatRequests.push(
      route.request().postDataJSON() as Record<string, unknown>,
    );
    await route.fulfill(
      chatRequests.length === 1
        ? {
            status: 429,
            json: { code: "quota", scope: "workspace" },
          }
        : {
            json: {
              outcome: "answered",
              answer: "После разблокировки: 274 000 ₽.",
              references: [{ id: "evidence-0" }],
            },
          },
    );
  });
  await page.route("**/api/access", async (route) => {
    const body = route.request().postDataJSON() as { code?: string };
    await route.fulfill(
      body.code === "wrong"
        ? { status: 401, json: { code: "invalid-code" } }
        : { json: { unlocked: true } },
    );
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  const composer = page.getByRole("textbox", { name: "Ваш вопрос к отчёту" });
  await composer.fill("Какая выручка?");
  await composer.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Продолжить диалог" }),
  ).toBeVisible();
  await page.getByLabel("Код доступа").fill("wrong");
  await page.getByRole("button", { name: "Продолжить диалог" }).click();
  await expect(
    page.getByText("Код не принят. Проверьте код на сегодня и повторите."),
  ).toBeVisible();
  expect(chatRequests).toHaveLength(1);

  await page.getByLabel("Код доступа").fill("valid-access");
  await page.getByRole("button", { name: "Продолжить диалог" }).click();

  await expect(page.getByText("После разблокировки: 274 000 ₽.")).toBeVisible();
  expect(chatRequests).toHaveLength(2);
  expect(chatRequests[1]).toEqual(chatRequests[0]);
  await expect(page.getByText("Какая выручка?")).toHaveCount(1);
});

test("shows an approximate analysis estimate while the server request is pending", async ({
  page,
}) => {
  let releaseAnalysis: (() => void) | undefined;
  const analysisPending = new Promise<void>((resolve) => {
    releaseAnalysis = resolve;
  });
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({
      json: { expiresAt: "2026-10-19T00:00:00.000Z" },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await page.route("**/api/analyze", async (route) => {
    await analysisPending;
    await route.fulfill({
      json: { analysisId, report: dashboardReport, expiresAt: reportExpiresAt },
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await expect(page.getByRole("status")).toHaveText("Выбор и проверка плана…");
  await expect(
    page.getByRole("progressbar", {
      name: "Оценка хода анализа, приблизительно",
    }),
  ).toBeVisible();
  const progressGeometry = await page
    .getByRole("progressbar", {
      name: "Оценка хода анализа, приблизительно",
    })
    .evaluate((bar) => {
      const track = bar.querySelector<HTMLElement>(
        '[data-slot="progress-bar-track"]',
      );
      const fill = bar.querySelector<HTMLElement>(
        '[data-slot="progress-bar-fill"]',
      );
      if (!track || !fill) throw new Error("Progress geometry is unavailable.");
      return {
        trackWidth: track.getBoundingClientRect().width,
        fillWidth: fill.getBoundingClientRect().width,
        animationName: getComputedStyle(fill).animationName,
        transitionDuration: getComputedStyle(fill).transitionDuration,
      };
    });
  expect(progressGeometry.fillWidth).toBeLessThan(
    progressGeometry.trackWidth * 0.2,
  );
  expect(progressGeometry.animationName).toBe("none");
  expect(Number.parseFloat(progressGeometry.transitionDuration)).toBeLessThan(
    0.001,
  );
  await expect(page.getByText("Детерминированный расчёт")).toBeVisible();
  await expect(page.getByText(/^Оценка, не измерение: \d+%$/)).toBeVisible();
  const estimateValue = Number(
    await page
      .getByRole("progressbar", {
        name: "Оценка хода анализа, приблизительно",
      })
      .getAttribute("aria-valuenow"),
  );
  expect(estimateValue).toBeGreaterThanOrEqual(0);
  expect(estimateValue).toBeLessThanOrEqual(95);
  await page.getByRole("button", { name: "Отменить анализ" }).click();
  releaseAnalysis?.();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
});

test("unlocks workspace quota with invite retry and preserves the source", async ({
  page,
}) => {
  let analysisCalls = 0;
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({ json: { expiresAt: "2026-10-19T00:00:00.000Z" } });
  });
  await page.route("**/api/analyze", async (route) => {
    analysisCalls += 1;
    if (analysisCalls === 1) {
      await route.fulfill({
        status: 429,
        json: { code: "quota", scope: "workspace" },
      });
      return;
    }
    await route.fulfill({
      json: { analysisId, report: dashboardReport, expiresAt: reportExpiresAt },
    });
  });
  await page.route("**/api/access", async (route) => {
    const body = route.request().postDataJSON() as { code?: string };
    await route.fulfill(
      body.code === "wrong"
        ? { status: 401, json: { code: "invalid-code" } }
        : { json: { unlocked: true } },
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await expect(
    page.getByRole("heading", { name: "Продолжить анализ" }),
  ).toBeVisible();
  const inviteInput = page.getByLabel("Код доступа");
  const inviteInputStyle = await inviteInput.evaluate((input) => {
    const bounds = input.getBoundingClientRect();
    return {
      backgroundColor: getComputedStyle(input).backgroundColor,
      height: bounds.height,
      width: bounds.width,
    };
  });
  expect(inviteInputStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(inviteInputStyle.height).toBeGreaterThanOrEqual(44);
  expect(inviteInputStyle.width).toBeGreaterThan(200);
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(
    page.getByRole("heading", { name: "Продолжить анализ" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ввести код доступа" }).click();
  await expect(
    page.getByRole("heading", { name: "Продолжить анализ" }),
  ).toBeVisible();
  await page.getByLabel("Код доступа").fill("wrong");
  await page.getByRole("button", { name: "Продолжить анализ" }).click();
  await expect(
    page.getByText("Код не принят. Проверьте код на сегодня и повторите."),
  ).toBeVisible();
  await page.getByLabel("Код доступа").fill("valid-invite");
  await page.getByRole("button", { name: "Продолжить анализ" }).click();
  await expect.poll(() => analysisCalls).toBe(2);
  await expect(
    page.getByRole("heading", { name: /Выручка выросла/ }),
  ).toBeVisible();
});

test("keeps code quota terminal without opening invite modal", async ({
  page,
}) => {
  await page.route("**/api/guest", async (route) => {
    await route.fulfill({ json: { expiresAt: "2026-10-19T00:00:00.000Z" } });
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 429,
      json: { code: "quota", scope: "unlocked-workspace" },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Загрузить синтетический демо-набор" })
    .click();
  await page.getByRole("button", { name: "Запустить AI-анализ" }).click();
  await expect(
    page.getByText("Лимит в 20 анализов на сегодня исчерпан."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Продолжить анализ" }),
  ).toHaveCount(0);
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
  await expect(page.getByText("ПОСЛЕ ПРОВЕРКИ ИСТОЧНИКА")).toBeVisible();
  await expect(page.getByText("Локальная проверка")).toHaveCount(0);
  await expect(page.locator(".brand")).toHaveText("datatale");
  await expect(
    page.getByText("Данные превращаются в понятную историю"),
  ).toBeVisible();
  const mobileLayout = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}.`);
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    };
    return {
      viewport: window.innerWidth,
      inputGrid: bounds(".input-grid"),
      upload: bounds(".dropzone"),
      text: bounds(".text-input"),
      demo: bounds(".demo-button"),
      footer: bounds("footer"),
      footerActions: bounds(".footer-actions"),
    };
  });
  for (const section of [
    mobileLayout.inputGrid,
    mobileLayout.upload,
    mobileLayout.text,
    mobileLayout.demo,
  ]) {
    expect(section.left).toBeGreaterThanOrEqual(0);
    expect(section.right).toBeLessThanOrEqual(mobileLayout.viewport);
    expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
  }
  expect(mobileLayout.footerActions.left).toBeCloseTo(
    mobileLayout.footer.left,
    0,
  );
  expect(mobileLayout.footerActions.right).toBeLessThanOrEqual(
    mobileLayout.footer.right,
  );
  const footerTrustAlignment = await page
    .locator(".footer-trust")
    .evaluate((trust) => {
      const icon = trust.querySelector("svg");
      const trustBox = trust.getBoundingClientRect();
      const iconBox = icon?.getBoundingClientRect();
      if (!iconBox) throw new Error("Footer trust icon is unavailable.");
      return Math.abs(
        iconBox.top + iconBox.height / 2 - (trustBox.top + trustBox.height / 2),
      );
    });
  expect(footerTrustAlignment).toBeLessThanOrEqual(1);
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
