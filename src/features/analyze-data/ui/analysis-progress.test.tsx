import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisProgress } from "./analysis-progress";

describe("analysis progress", () => {
  it("shows an indeterminate, preparation phase for a table", () => {
    render(<AnalysisProgress phase="session-setup" sourceKind="table" />);

    expect(
      screen.getByRole("progressbar", { name: "Ход анализа" }),
    ).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Подготавливаем защищённый сеанс",
    );
    expect(screen.getByText("Выбор и проверка плана")).toBeVisible();
    expect(screen.getByText("Детерминированный расчёт")).toBeVisible();
    expect(
      screen.getByText("Формирование итогового повествования"),
    ).toBeVisible();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("uses text lifecycle names and marks only the observable phase active", () => {
    render(<AnalysisProgress phase="processing" sourceKind="text" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Извлечение проверяемых фактов",
    );
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Извлечение проверяемых фактов",
    );
    expect(screen.queryByText("Выбор и проверка плана")).toBeNull();
    expect(
      screen.getByText("Формирование итогового повествования"),
    ).toBeVisible();
  });
});
