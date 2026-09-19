import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryPicker, historyLabel } from "./history-picker";

const base = {
  sourceKind: "text" as const,
  createdAt: "2026-09-19T12:00:00.000Z",
  expiresAt: "2026-09-26T12:00:00.000Z",
};

describe("history picker labels", () => {
  it("distinguishes same-kind reports created on the same day", () => {
    const first = historyLabel({
      ...base,
      id: "00000000-0000-4000-8000-000000000002",
    });
    const second = historyLabel({
      ...base,
      id: "00000000-0000-4000-8000-000000000003",
    });
    expect(first).not.toBe(second);
    expect(first).toMatch(/\d{2}:\d{2}/);
  });

  it("announces opening and completion for assistive technology", () => {
    const analysis = {
      ...base,
      id: "00000000-0000-4000-8000-000000000002",
    };
    const view = render(
      <HistoryPicker
        analyses={[analysis]}
        loading={false}
        error={false}
        opening
        openError={false}
        loaded={false}
        onOpen={() => undefined}
        onRetry={() => undefined}
        onRetryList={() => undefined}
      />,
    );
    expect(
      screen.getByText("Открываем отчёт…", { selector: "p" }),
    ).toHaveAttribute("aria-live", "polite");
    view.rerender(
      <HistoryPicker
        analyses={[analysis]}
        loading={false}
        error={false}
        opening={false}
        openError={false}
        loaded
        onOpen={() => undefined}
        onRetry={() => undefined}
        onRetryList={() => undefined}
      />,
    );
    expect(screen.getByText("Отчёт открыт.")).toBeVisible();
  });
});
