"use client";

import type { FinalReport } from "@/entities/report";
import { ReportDashboard } from "@/entities/report/ui";
import {
  AskDataPanel,
  type AskDataResult,
  type AskDataSend,
} from "@/features/query-report";

const demoReport = {
  version: 1,
  hero: [
    {
      text: "Команда уверенно растёт, а онлайн-канал лидирует.",
      factIds: ["revenue"],
      evidenceIds: ["rows"],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "revenue",
      label: "Выручка",
      value: 274000,
      unit: "₽",
      evidenceIds: ["rows"],
    },
  ],
  charts: [
    {
      id: "regions",
      kind: "bar",
      title: "По регионам",
      rationale: "Сравнение регионов",
      points: [
        { label: "Север", value: 120000 },
        { label: "Юг", value: 154000 },
      ],
      evidenceIds: ["rows"],
    },
    {
      id: "months",
      kind: "line",
      title: "По месяцам",
      rationale: "Динамика выручки",
      points: [
        { label: "Январь", value: 128000 },
        { label: "Февраль", value: 146000 },
      ],
      evidenceIds: ["rows"],
    },
  ],
  evidence: [
    {
      id: "rows",
      kind: "row-range",
      label: "Все строки демо-источника",
      coverage: { included: 12, total: 12 },
    },
  ],
  recommendations: [
    {
      text: "Проверьте рост онлайн-канала.",
      factIds: ["revenue"],
      evidenceIds: ["rows"],
      kind: "action",
    },
  ],
} satisfies FinalReport;

const demoAsk: AskDataSend = async (
  _request,
  _signal,
): Promise<AskDataResult> => ({
  status: "answered",
  answer: "В демо-отчёте выручка составила 274 000 ₽, а южный регион лидирует.",
  evidenceLabels: ["Все строки демо-источника"],
});

export function OnboardingDemo() {
  return (
    <section
      aria-label="Демо-результат анализа"
      className="onboarding-demo-workspace onboarding-demo-analysis"
    >
      <ReportDashboard report={demoReport} />
      <AskDataPanel send={demoAsk} />
    </section>
  );
}
