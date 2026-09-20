import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FinalReport } from "../model/schema";
import { ReportDashboard } from "./report-dashboard";

const report = {
  version: 1,
  hero: [
    {
      text: "Первый вывод.",
      factIds: ["fact"],
      evidenceIds: ["rows"],
      kind: "observation" as const,
    },
    {
      text: "Второй вывод.",
      factIds: ["fact"],
      evidenceIds: ["rows"],
      kind: "observation" as const,
    },
  ],
  metrics: [
    {
      id: "fact",
      label: "Выручка",
      value: 120,
      unit: "RUB",
      calculation: {
        kind: "sum" as const,
        fieldId: "revenue",
        fieldLabel: "Выручка",
      },
      evidenceIds: ["rows"],
    },
  ],
  charts: [
    {
      id: "chart",
      kind: "bar" as const,
      title: "По регионам",
      rationale: "Сравнение регионов",
      aggregation: {
        kind: "sum" as const,
        fieldId: "revenue",
        fieldLabel: "Выручка",
        dimensionFieldId: "region",
        dimensionLabel: "Регион",
      },
      points: [{ label: "Север", value: 120 }],
      evidenceIds: ["rows"],
    },
  ],
  evidence: [
    {
      id: "rows",
      kind: "row-range" as const,
      label: "Принятые строки",
      coverage: { included: 8, total: 10 },
    },
  ],
  recommendations: [],
  noChartReason: "Недостаточно временных рядов.",
} satisfies FinalReport;

describe("ReportDashboard", () => {
  it("shows saved expiry, calculation and evidence coverage", () => {
    render(
      <ReportDashboard report={report} expiresAt="2026-09-26T12:00:00.000Z" />,
    );

    expect(screen.getByText(/Отчёт и вопросы хранятся до/)).toBeVisible();
    const metricValue = screen.getByText("RUB").closest(".metric-value");
    expect(metricValue).toHaveTextContent("120RUB");
    expect(screen.getByText(/Расчёт: Сумма поля «Выручка»/)).toBeVisible();
    expect(screen.getByText(/Строки таблицы · Принятые строки/)).toBeVisible();
    expect(screen.getByText(/Покрытие: 8 из 10/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Развернуть/ }));
    expect(
      screen.getByText(/Расчёт: Сумма поля «Выручка» по полю «Регион»/),
    ).toBeVisible();
    expect(
      screen.getAllByText(/Строки таблицы · Принятые строки/),
    ).toHaveLength(2);
  });
});
