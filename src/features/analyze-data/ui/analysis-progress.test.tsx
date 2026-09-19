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

  it("uses text lifecycle names and marks only the observable phase active", () => {
    render(
      <AnalysisProgress phase="processing" progress={95} sourceKind="text" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Почти закончили — ждём ответ AI",
    );
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Извлечение проверяемых фактов",
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
  });
});
