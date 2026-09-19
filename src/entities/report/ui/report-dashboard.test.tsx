import { render, screen } from "@testing-library/react";
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
      calculation: { kind: "sum" as const, fieldLabel: "Выручка" },
      evidenceIds: ["rows"],
    },
  ],
  charts: [],
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
    expect(screen.getByText(/Расчёт: Сумма поля «Выручка»/)).toBeVisible();
    expect(screen.getByText(/Строки таблицы · Принятые строки/)).toBeVisible();
    expect(screen.getByText(/Покрытие: 8 из 10/)).toBeVisible();
  });
});
