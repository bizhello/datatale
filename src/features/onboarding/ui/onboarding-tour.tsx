"use client";

import { Button } from "@heroui/react";
import { type DriveStep, driver, type PopoverDOM } from "driver.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readOnboardingPreference,
  writeOnboardingPreference,
} from "../model/onboarding-preference";

type OnboardingTourProps = {
  hydrated: boolean;
  onSessionChange: (active: boolean) => void;
};
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
    element: ".onboarding-demo-analysis",
    popover: {
      title: "Проверьте и запустите анализ",
      description:
        "После проверки источника здесь появляется готовый результат анализа.",
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
      title: "Спросите данные",
      description:
        "Задайте вопрос по готовому отчёту — ответ будет основан на его источнике.",
    },
  },
];

function availableSteps() {
  return tourSteps.filter(
    (step) =>
      typeof step.element !== "string" ||
      document.querySelector(step.element) !== null,
  );
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

export function OnboardingTour({
  hydrated,
  onSessionChange,
}: OnboardingTourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | undefined>(undefined);
  const actionRef = useRef<TourAction | undefined>(undefined);
  const focusRef = useRef<HTMLElement | undefined>(undefined);
  const replayRef = useRef<HTMLButtonElement>(null);
  const welcomeStartRef = useRef<HTMLButtonElement>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);

  const finish = useCallback((action: TourAction) => {
    if (actionRef.current) return;
    actionRef.current = action;
    writeOnboardingPreference(action);
  }, []);

  const restoreFocus = useCallback(() => {
    const target = focusRef.current;
    if (target?.isConnected) target.focus();
    else replayRef.current?.focus();
    focusRef.current = undefined;
  }, []);

  const startDriver = useCallback(() => {
    const steps = availableSteps();
    if (!steps.length) {
      finish("skipped");
      onSessionChange(false);
      restoreFocus();
      return;
    }
    actionRef.current = undefined;
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
        if (!actionRef.current) finish("skipped");
        options.driver.destroy();
      },
      onDestroyed: () => {
        onSessionChange(false);
        restoreFocus();
      },
      onDoneClick: (_element, _step, options) => {
        finish("completed");
        options.driver.destroy();
      },
    });
    driverRef.current = instance;
    instance.drive();
  }, [finish, onSessionChange, restoreFocus]);

  useEffect(() => {
    if (!pendingStart) return;
    const timer = window.setTimeout(() => {
      setPendingStart(false);
      startDriver();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingStart, startDriver]);

  useEffect(() => {
    if (hydrated && !readOnboardingPreference()) setWelcomeOpen(true);
  }, [hydrated]);
  useEffect(() => () => driverRef.current?.destroy(), []);

  const begin = (trigger: HTMLElement | null) => {
    focusRef.current = trigger ?? replayRef.current ?? undefined;
    setWelcomeOpen(false);
    onSessionChange(true);
    setPendingStart(true);
  };
  const skipWelcome = () => {
    finish("skipped");
    setWelcomeOpen(false);
    replayRef.current?.focus();
  };

  return (
    <>
      <Button
        ref={replayRef}
        aria-label="Открыть знакомство с DataTale"
        className="onboarding-replay"
        variant="tertiary"
        onPress={() => begin(replayRef.current)}
      >
        Как это работает?
      </Button>
      {welcomeOpen && (
        <section
          aria-labelledby="onboarding-welcome-title"
          className="onboarding-welcome"
          role="dialog"
        >
          <h2 id="onboarding-welcome-title">Добро пожаловать в DataTale</h2>
          <p>
            За минуту покажем, как загрузить источник, прочитать анализ и задать
            вопрос данным.
          </p>
          <div className="onboarding-welcome-actions">
            <Button
              ref={welcomeStartRef}
              onPress={() => begin(welcomeStartRef.current)}
            >
              Начать знакомство
            </Button>
            <Button variant="tertiary" onPress={skipWelcome}>
              Пропустить
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
