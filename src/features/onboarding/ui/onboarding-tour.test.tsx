import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ONBOARDING_STORAGE_KEY,
  readOnboardingPreference,
} from "../model/onboarding-preference";
import { OnboardingTour } from "./onboarding-tour";

type FakeDriver = {
  drive: () => void;
  destroy: () => void;
  isLastStep: () => boolean;
};
type FakeConfig = {
  steps?: unknown[];
  onCloseClick?: (
    element: Element | undefined,
    step: unknown,
    options: { driver: FakeDriver },
  ) => void;
  onDestroyStarted?: (
    element: Element | undefined,
    step: unknown,
    options: { driver: FakeDriver },
  ) => void;
};
const driverState = vi.hoisted(() => ({
  config: undefined as FakeConfig | undefined,
  instance: undefined as FakeDriver | undefined,
}));
vi.mock("driver.js", () => ({
  driver: vi.fn((config) => {
    driverState.config = config;
    driverState.instance = {
      drive: vi.fn(),
      destroy: vi.fn(() => config.onDestroyed?.()),
      isLastStep: vi.fn(() => false),
    };
    return driverState.instance;
  }),
}));

function targets() {
  return (
    <>
      <div className="input-grid" />
      <div className="dropzone" />
      <div id="onboarding-demo" />
      <div className="onboarding-demo-analysis" />
      <div className="onboarding-demo-workspace">
        <div className="chart-heading">
          <button type="button">chart</button>
        </div>
        <div data-onboarding-ask="true" />
      </div>
    </>
  );
}

describe("OnboardingTour", () => {
  beforeEach(() => {
    window.localStorage.clear();
    driverState.config = undefined;
    driverState.instance = undefined;
  });

  it("shows the canonical welcome and starts a deterministic tour", async () => {
    const onSessionChange = vi.fn();
    render(
      <>
        <OnboardingTour hydrated onSessionChange={onSessionChange} />
        {targets()}
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Добро пожаловать в DataTale" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Начать знакомство" }));
    expect(onSessionChange).toHaveBeenCalledWith(true);
    await waitFor(() => expect(driverState.instance?.drive).toHaveBeenCalled());
    expect(driverState.config?.steps).toHaveLength(5);
  });

  it("persists skip and restores focus to the initiating control", async () => {
    const onSessionChange = vi.fn();
    render(
      <>
        <OnboardingTour hydrated onSessionChange={onSessionChange} />
        {targets()}
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    const replay = screen.getByRole("button", {
      name: "Открыть знакомство с DataTale",
    });
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("skipped");
    fireEvent.click(replay);
    await waitFor(() => expect(driverState.instance?.drive).toHaveBeenCalled());
    const instance = driverState.instance;
    const onCloseClick = driverState.config?.onCloseClick;
    if (!instance || !onCloseClick) throw new Error("Driver did not start");
    onCloseClick(undefined, undefined, { driver: instance });
    expect(readOnboardingPreference()).toBe("skipped");
    expect(replay).toHaveFocus();
  });

  it("tears down safely when escape arrives during the first highlight", async () => {
    const onSessionChange = vi.fn();
    render(
      <>
        <OnboardingTour hydrated onSessionChange={onSessionChange} />
        {targets()}
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Начать знакомство" }));
    await waitFor(() => expect(driverState.instance?.drive).toHaveBeenCalled());
    const instance = driverState.instance;
    const onDestroyStarted = driverState.config?.onDestroyStarted;
    if (!instance || !onDestroyStarted) throw new Error("Driver did not start");
    onDestroyStarted(undefined, undefined, { driver: instance });
    expect(onSessionChange).toHaveBeenLastCalledWith(false);
  });
});
