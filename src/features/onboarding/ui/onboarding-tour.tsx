"use client";

import { Button } from "@heroui/react";
import { type DriveStep, driver, type PopoverDOM } from "driver.js";
import { useCallback, useEffect, useRef } from "react";
import {
  readOnboardingPreference,
  writeOnboardingPreference,
} from "../model/onboarding-preference";

type OnboardingTourProps = { hydrated: boolean };
type TourAction = "completed" | "skipped";

const tourSteps: ReadonlyArray<DriveStep> = [
  {
    element: "#onboarding-source",
    popover: {
      title: "Начните с источника",
      description:
        "Загрузите CSV или XLSX, либо вставьте текст. Файл проверяется в браузере до запуска анализа.",
    },
  },
  {
    element: ".dropzone",
    popover: {
      title: "Таблица или файл",
      description: "Выберите файл или перетащите его в эту область.",
    },
  },
  {
    element: "#onboarding-text-input",
    popover: {
      title: "Можно вставить текст",
      description: "Короткие отчёты и заметки подходят так же хорошо.",
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
    element: "#onboarding-analysis-flow",
    popover: {
      title: "Проверьте и запустите анализ",
      description:
        "После проверки источника здесь появится кнопка запуска анализа.",
    },
  },
  {
    element: "#onboarding-theme",
    popover: {
      title: "Выберите тему",
      description: "Переключите светлую, тёмную или системную тему.",
    },
  },
  {
    element: "#onboarding-chart-expand",
    popover: {
      title: "Изучайте диаграммы",
      description:
        "Разверните диаграмму, чтобы рассмотреть её и увидеть исходные значения.",
    },
  },
  {
    element: "#onboarding-ask-data",
    popover: {
      title: "Спросите данные",
      description:
        "Задайте вопрос по готовому отчёту — ответ будет основан на его источнике.",
    },
  },
];

function availableSteps() {
  return tourSteps.filter((step) => {
    if (typeof step.element !== "string") return true;
    return document.querySelector(step.element) !== null;
  });
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function addSkipButton(popover: PopoverDOM, skip: () => void) {
  const button = document.createElement("button");
  button.className = "driver-popover-footer-btn onboarding-skip";
  button.type = "button";
  button.textContent = "Пропустить";
  button.addEventListener("click", skip, { once: true });
  popover.footerButtons.prepend(button);
}

export function OnboardingTour({ hydrated }: OnboardingTourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | undefined>(undefined);
  const actionRef = useRef<TourAction | undefined>(undefined);

  const start = useCallback((initial = false) => {
    const steps = availableSteps();
    if (!steps.length) return;
    actionRef.current = undefined;
    const finish = (action: TourAction) => {
      if (actionRef.current) return;
      actionRef.current = action;
      writeOnboardingPreference(action);
    };
    const skip = () => {
      finish("skipped");
      driverRef.current?.destroy();
    };
    const instance = driver({
      animate: !prefersReducedMotion(),
      allowClose: true,
      allowKeyboardControl: true,
      nextBtnText: "Далее",
      prevBtnText: "Назад",
      doneBtnText: "Готово",
      showProgress: true,
      progressText: "{{current}} из {{total}}",
      overlayOpacity: 0.56,
      popoverClass: "onboarding-popover",
      smoothScroll: !prefersReducedMotion(),
      steps,
      onPopoverRender: (popover) => addSkipButton(popover, skip),
      onCloseClick: skip,
      onDestroyStarted: (_element, _step, options) => {
        if (options.driver.isLastStep()) finish("completed");
        else finish("skipped");
        options.driver.destroy();
      },
      onDoneClick: (_element, _step, options) => {
        finish("completed");
        options.driver.destroy();
      },
    });
    driverRef.current = instance;
    instance.drive();
    if (initial) window.setTimeout(() => instance.refresh(), 0);
  }, []);

  useEffect(() => {
    if (!hydrated || readOnboardingPreference()) return;
    const timer = window.setTimeout(() => start(true), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, start]);

  useEffect(() => () => driverRef.current?.destroy(), []);

  return (
    <Button
      aria-label="Открыть знакомство с DataTale"
      className="onboarding-replay"
      variant="tertiary"
      onPress={() => start()}
    >
      Как это работает?
    </Button>
  );
}
