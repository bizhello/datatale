import type { FinalReport } from "@/entities/report";
import type { AskDataResult, AskDataSend } from "@/features/query-report";

export const onboardingDemoReport = {
  version: 1,
  hero: [
    {
      text: "Команда уверенно растёт, а онлайн-канал лидирует.",
      factIds: ["revenue"],
      evidenceIds: ["rows"],
      kind: "observation",
    },
    {
      text: "Выручка подтверждена всеми строками демо-источника.",
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
      calculation: { kind: "sum", fieldId: "revenue", fieldLabel: "Выручка" },
      evidenceIds: ["rows"],
    },
  ],
  charts: [
    {
      id: "regions",
      kind: "bar",
      title: "По регионам",
      rationale: "Сравнение регионов",
      aggregation: {
        kind: "sum",
        fieldId: "revenue",
        fieldLabel: "Выручка",
        dimensionFieldId: "region",
        dimensionLabel: "Регион",
      },
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
      aggregation: {
        kind: "sum",
        fieldId: "revenue",
        fieldLabel: "Выручка",
        dimensionFieldId: "month",
        dimensionLabel: "Месяц",
      },
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

export const onboardingDemoAsk: AskDataSend = async (
  _request,
  _signal,
): Promise<AskDataResult> => ({
  status: "answered",
  answer: "В демо-отчёте выручка составила 274 000 ₽, а южный регион лидирует.",
  evidenceLabels: ["Все строки демо-источника"],
});
