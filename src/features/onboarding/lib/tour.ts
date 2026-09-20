import type { DriveStep, PopoverDOM } from "driver.js";

export type TourAction = "completed" | "skipped";

export const tourSteps: ReadonlyArray<DriveStep> = [
  {
    element: ".input-grid",
    popover: {
      title: "Начните с источника",
      description:
        "Загрузите CSV или XLSX, либо вставьте текст. Файл проверяется в браузере до запуска анализа.",
    },
  },
  {
    element: "#onboarding-demo",
    popover: {
      title: "Попробуйте демо",
      description:
        "Синтетический набор покажет весь сценарий без подготовки файла.",
    },
  },
  {
    element: ".onboarding-demo-analysis",
    popover: {
      title: "Прочитайте главный вывод",
      description:
        "AI формулирует суть в 2–3 предложениях, а метрики и основание вывода связывают её с проверенными данными.",
    },
  },
  {
    element: ".onboarding-demo-workspace .chart-heading button",
    popover: {
      title: "Изучайте диаграммы",
      description:
        "Разверните диаграмму, чтобы рассмотреть её и увидеть исходные значения.",
    },
  },
  {
    element: ".onboarding-demo-workspace [data-onboarding-ask]",
    popover: {
      title: "Задайте вопрос по отчёту",
      description:
        "Задайте вопрос по готовому отчёту — ответ будет основан на его источнике.",
    },
  },
];

export function availableSteps() {
  return tourSteps.filter(
    (step) =>
      typeof step.element !== "string" ||
      document.querySelector(step.element) !== null,
  );
}
export function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export function addSkipButton(popover: PopoverDOM, skip: () => void) {
  const button = document.createElement("button");
  button.className = "driver-popover-footer-btn onboarding-skip";
  button.type = "button";
  button.textContent = "Пропустить";
  button.addEventListener("click", skip, { once: true });
  popover.footerButtons.prepend(button);
}
