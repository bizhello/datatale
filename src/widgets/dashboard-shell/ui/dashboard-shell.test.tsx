import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "./dashboard-shell";

describe("Dashboard starter", () => {
  it("identifies the preview as an example rather than a generated result", () => {
    render(<DashboardShell />);
    expect(screen.getByText("Пример · не AI-анализ")).toBeVisible();
    expect(screen.getByText("8 из 20 в примере")).toBeVisible();
  });

  it("opens and closes the plan while keeping the disclosure state accessible", () => {
    render(<DashboardShell />);
    const button = screen.getByRole("button", { name: "Посмотреть план MVP" });
    const heading = screen.getByText(
      "Следующий шаг — один законченный сценарий",
    );
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(heading).not.toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(heading).toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(heading).not.toBeVisible();
  });
});
