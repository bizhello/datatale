import type { Dataset } from "@/entities/dataset";
import {
  type Aggregation,
  type AnalysisProposal,
  analysisProposalSchema,
  BAR_MAX_CATEGORIES,
  type ChartSpecification,
  LINE_MAX_POINTS,
  type MetricSpecification,
} from "@/entities/report";
import {
  isChartSpecificationSupported,
  validateTableProposal,
} from "./semantic";

function aggregationLabel(source: Dataset, aggregation: Aggregation) {
  if (aggregation.kind === "count") return "Количество строк";
  const field = source.columns.find(
    (column) => column.id === aggregation.field.fieldId,
  );
  const prefix =
    aggregation.kind === "sum"
      ? "Сумма"
      : aggregation.kind === "average"
        ? "Среднее"
        : aggregation.kind === "min"
          ? "Минимум"
          : "Максимум";
  return `${prefix}: ${field?.label ?? aggregation.field.fieldId}`;
}

function fallbackMetrics(source: Dataset): MetricSpecification[] {
  const numeric = source.columns.filter(
    (column) => column.scalarType === "number",
  );
  const aggregations: Aggregation[] = numeric.slice(0, 3).map((column) => ({
    kind: "sum" as const,
    field: { fieldId: column.id },
  }));
  if (aggregations.length === 1)
    aggregations.push({
      kind: "average",
      field: { fieldId: numeric[0]?.id ?? "" },
    });
  return aggregations.map((aggregation, index) => ({
    id: `fallback-metric-${index + 1}`,
    label: aggregationLabel(source, aggregation),
    aggregation,
  }));
}

function fallbackChartCandidates(source: Dataset): ChartSpecification[] {
  const numeric = source.columns.filter(
    (column) => column.scalarType === "number",
  );
  const aggregations: Aggregation[] = [
    { kind: "count" },
    ...numeric.map((column) => ({
      kind: "sum" as const,
      field: { fieldId: column.id },
    })),
  ];
  const candidates: ChartSpecification[] = [];
  for (const dimension of source.columns) {
    for (const aggregation of aggregations) {
      const measure = aggregationLabel(source, aggregation);
      const candidate: ChartSpecification | undefined =
        dimension.scalarType === "string" || dimension.scalarType === "boolean"
          ? {
              id: `fallback-chart-${candidates.length + 1}`,
              kind: "bar",
              title: `${measure} по полю «${dimension.label}»`,
              rationale: "Сравнение проверенных значений между категориями.",
              dimension: { fieldId: dimension.id },
              aggregation,
              categoryLimit: BAR_MAX_CATEGORIES,
            }
          : dimension.scalarType === "date"
            ? {
                id: `fallback-chart-${candidates.length + 1}`,
                kind: "line",
                title: `${measure} по полю «${dimension.label}»`,
                rationale: "Изменение проверенного показателя по времени.",
                dimension: { fieldId: dimension.id },
                aggregation,
                pointLimit: LINE_MAX_POINTS,
                missingPeriodPolicy: "reject",
              }
            : undefined;
      if (candidate && isChartSpecificationSupported(source, candidate))
        candidates.push(candidate);
    }
  }
  return candidates.slice(0, 3);
}

/**
 * Last-resort plan used only after the provider's proposal and repair both
 * fail validation. Application code still calculates every displayed value.
 */
export function createFallbackTableProposal(
  source: Dataset,
): AnalysisProposal | undefined {
  const metrics = fallbackMetrics(source);
  if (metrics.length < 2) return undefined;
  const charts = fallbackChartCandidates(source);
  const candidate: AnalysisProposal =
    charts.length >= 2
      ? { outcome: "charts", metrics, charts }
      : {
          outcome: "no-chart",
          metrics,
          reason:
            "Данные не поддерживают две разные и достоверные истории для графиков.",
        };
  const proposal = analysisProposalSchema.parse(candidate);
  validateTableProposal(source, proposal);
  return proposal;
}
