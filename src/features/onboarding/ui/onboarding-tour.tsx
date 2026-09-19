"use client";

import { Button, Modal } from "@heroui/react";
import { driver } from "driver.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSkipButton,
  availableSteps,
  prefersReducedMotion,
  type TourAction,
} from "../lib/tour";
import {
  readOnboardingPreference,
  writeOnboardingPreference,
} from "../model/onboarding-preference";

type OnboardingTourProps = {
  hydrated: boolean;
  onSessionChange: (active: boolean) => void;
};
export function OnboardingTour({
  hydrated,
  onSessionChange,
}: OnboardingTourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | undefined>(undefined);
  const actionRef = useRef<TourAction | undefined>(undefined);
  const focusRef = useRef<HTMLElement | undefined>(undefined);
  const teardownRef = useRef<() => void>(() => undefined);
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
    let ended = false;
    const teardown = () => {
      if (ended) return;
      ended = true;
      driverRef.current = undefined;
      onSessionChange(false);
      restoreFocus();
    };
    teardownRef.current = teardown;
    const skip = () => {
      finish("skipped");
      instance.destroy();
      teardown();
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
        teardown();
      },
      onDestroyed: teardown,
      onDoneClick: (_element, _step, options) => {
        finish("completed");
        options.driver.destroy();
        teardown();
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
  useEffect(() => {
    if (welcomeOpen) welcomeStartRef.current?.focus();
  }, [welcomeOpen]);
  useEffect(
    () => () => {
      const activeDriver = driverRef.current;
      teardownRef.current();
      activeDriver?.destroy();
    },
    [],
  );

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
      <Modal.Root
        isOpen={welcomeOpen}
        onOpenChange={(open) => {
          if (open) setWelcomeOpen(true);
        }}
      >
        <Modal.Backdrop isDismissable={false}>
          <Modal.Container className="onboarding-welcome" size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="onboarding-welcome-title">
                  Добро пожаловать в DataTale
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="onboarding-welcome-copy">
                  За минуту покажем, как загрузить источник, прочитать анализ и
                  задать вопрос данным.
                </p>
                <div className="onboarding-welcome-actions">
                  <Button
                    className="onboarding-start"
                    ref={welcomeStartRef}
                    onPress={() => begin(welcomeStartRef.current)}
                  >
                    Начать знакомство
                  </Button>
                  <Button
                    className="onboarding-skip-welcome"
                    variant="tertiary"
                    onPress={skipWelcome}
                  >
                    Пропустить
                  </Button>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </>
  );
}
