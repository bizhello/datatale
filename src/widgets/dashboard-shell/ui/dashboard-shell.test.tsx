import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "./dashboard-shell";

describe("Dashboard input shell", () => {
  it("offers local source choices and has no fake analysis action", () => {
    render(<DashboardShell />);
    expect(
      screen.getByText(/Файлы обрабатываются в этом браузере/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Загрузить синтетический демо-набор",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/запустить анализ/i)).not.toBeInTheDocument();
  });
  it("accepts text and shows its exact source preview", () => {
    render(<DashboardShell />);
    fireEvent.change(screen.getByLabelText("Текст отчёта"), {
      target: { value: "Первый абзац.\n\nВторой абзац." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Проверить текст" }));
    expect(screen.getByText("Текст готов к анализу")).toBeVisible();
    expect(screen.getByText("Первый абзац.")).toBeVisible();
  });
});
