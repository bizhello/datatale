import type { AnalysisPlan } from "@/entities/report";

export const chartedAnalysisPlanFixture: AnalysisPlan = {
  outcome: "charts",
  metrics: [
    {
      id: "total-revenue",
      label: "Total revenue",
      aggregation: { kind: "sum", field: { fieldId: "revenue" } },
    },
    { id: "order-count", label: "Orders", aggregation: { kind: "count" } },
  ],
  charts: [
    {
      id: "revenue-by-region",
      kind: "bar",
      title: "Revenue by region",
      rationale: "Compares revenue across sales regions.",
      dimension: { fieldId: "region" },
      aggregation: { kind: "sum", field: { fieldId: "revenue" } },
      categoryLimit: 12,
    },
    {
      id: "orders-over-time",
      kind: "line",
      title: "Orders over time",
      rationale: "Shows the monthly order trend.",
      dimension: { fieldId: "month" },
      aggregation: { kind: "count" },
      pointLimit: 12,
      missingPeriodPolicy: "reject",
    },
    {
      id: "revenue-share",
      kind: "donut",
      title: "Revenue share by channel",
      rationale: "Shows each channel's additive share of revenue.",
      dimension: { fieldId: "channel" },
      aggregation: { kind: "sum", field: { fieldId: "revenue" } },
      segmentLimit: 4,
    },
  ],
};

export const noChartAnalysisPlanFixture: AnalysisPlan = {
  outcome: "no-chart",
  reason: "The source has no useful quantities to visualize.",
  metrics: [
    { id: "count", label: "Count", aggregation: { kind: "count" } },
    {
      id: "minimum",
      label: "Minimum",
      aggregation: { kind: "min", field: { fieldId: "metric" } },
    },
  ],
};
