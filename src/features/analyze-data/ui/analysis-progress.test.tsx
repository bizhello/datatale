import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisProgress } from "./analysis-progress";

describe("analysis progress", () => {
  it("shows an approximate determinate estimate for a table", () => {
    render(
      <AnalysisProgress
        phase="session-setup"
        progress={0}
        sourceKind="table"
      />,
    );

    expect(
      screen.getByRole("progressbar", {
        name: "Оценка хода анализа, приблизительно",
      }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Подготавливаем защищённый сеанс",
    );
    expect(screen.getByText("Выбор и проверка плана")).toBeVisible();
    expect(screen.getByText("Детерминированный расчёт")).toBeVisible();
    expect(
      screen.getByText("Формирование итогового повествования"),
    ).toBeVisible();
    expect(screen.getByText("Оценка, не измерение: 0%")).toBeVisible();
  });

  it("shows the final estimated stage at the 95 percent cap", () => {
    render(
      <AnalysisProgress phase="processing" progress={95} sourceKind="text" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Почти закончили — ждём ответ AI",
    );
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Формирование итогового повествования",
    );
    expect(screen.queryByText("Выбор и проверка плана")).toBeNull();
    expect(
      screen.getByText("Формирование итогового повествования"),
    ).toBeVisible();
    expect(screen.getByText("Оценка, не измерение: 95%")).toBeVisible();
  });

  it("announces completion separately from the estimate", () => {
    render(
      <AnalysisProgress phase="processing" progress={100} sourceKind="table" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Анализ завершён");
    expect(screen.getByText("Оценка, не измерение: 100%")).toBeVisible();
    expect(screen.queryByRole("listitem", { current: "step" })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const item of screen.getAllByRole("listitem"))
      expect(item).toHaveClass("is-complete");
  });
});
