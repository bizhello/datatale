import type { Dataset } from "@/entities/dataset";
import type {
  Aggregation,
  AnalysisProposal,
  ChartSpecification,
  MetricSpecification,
} from "@/entities/report";
import {
  BAR_MAX_CATEGORIES,
  DONUT_MAX_SEGMENTS,
  DONUT_MIN_SEGMENTS,
  LINE_MAX_POINTS,
  LINE_MIN_POINTS,
} from "@/entities/report";
import { calculateChart } from "./calculate";

export type SemanticIssue = { path: string; message: string };
export class SemanticValidationError extends Error {
  constructor(readonly issues: SemanticIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
}
const valuesFor = (source: Dataset, id: string) =>
  source.rows.map((row) => row.values[id]);
const field = (source: Dataset, id: string) =>
  source.columns.find((column) => column.id === id);
const isCategoricalType = (
  scalarType: Dataset["columns"][number]["scalarType"],
) => scalarType === "string" || scalarType === "boolean";
const aggregationIssues = (
  source: Dataset,
  specification: MetricSpecification | ChartSpecification,
  path: string,
): SemanticIssue[] => {
  if (specification.aggregation.kind === "count") return [];
  const measure = field(source, specification.aggregation.field.fieldId);
  if (!measure) return [{ path, message: "references an unknown measure." }];
  if (measure.scalarType !== "number")
    return [{ path, message: "requires a numeric measure." }];
  if (!valuesFor(source, measure.id).some((value) => typeof value === "number"))
    return [{ path, message: "has no numeric values." }];
  return [];
};
function hasMissingCalendarPeriod(labels: string[]): boolean {
  if (labels.length < 3) return false;
  const calendar = labels
    .map((label) => ({
      year: Number(label.slice(0, 4)),
      month: Number(label.slice(5, 7)),
      day: Number(label.slice(8, 10)),
    }))
    .sort(
      (left, right) =>
        left.year - right.year ||
        left.month - right.month ||
        left.day - right.day,
    );
  if (calendar.every((date) => date.day === 1)) {
    const months = calendar.map((date) => date.year * 12 + date.month);
    return months
      .slice(1)
      .some((month, index) => month - (months[index] ?? month) !== 1);
  }
  const dates = labels
    .map((label) => new Date(`${label}T00:00:00Z`).getTime())
    .sort((a, b) => a - b);
  const gaps = dates
    .slice(1)
    .map((date, index) => date - (dates[index] ?? date));
  const smallest = Math.min(...gaps);
  return gaps.some((gap) => gap > smallest);
}

function chartIssues(
  source: Dataset,
  chart: ChartSpecification,
  path: string,
): SemanticIssue[] {
  const dimension = field(source, chart.dimension.fieldId);
  if (!dimension)
    return [{ path, message: "references an unknown dimension." }];
  const issues = aggregationIssues(source, chart, path);
  const labels = [
    ...new Set(
      valuesFor(source, dimension.id)
        .filter((value) => value !== null)
        .map(String),
    ),
  ];
  if (labels.length === 0)
    issues.push({ path, message: "dimension has no non-missing values." });
  if (chart.kind === "line") {
    if (dimension.scalarType !== "date")
      issues.push({
        path,
        message: "line charts require a temporal date dimension.",
      });
    if (
      labels.length < LINE_MIN_POINTS ||
      labels.length > LINE_MAX_POINTS ||
      labels.length > chart.pointLimit
    )
      issues.push({
        path,
        message: "line charts require 2-24 bounded periods.",
      });
    if (hasMissingCalendarPeriod(labels))
      issues.push({
        path,
        message:
          "line periods have a gap and the reject policy forbids connecting it.",
      });
  }
  if (chart.kind === "bar") {
    if (!isCategoricalType(dimension.scalarType))
      issues.push({
        path,
        message: "bar charts require a categorical dimension.",
      });
    if (labels.length < 2)
      issues.push({
        path,
        message: "bar charts require at least two categories.",
      });
    if (labels.length > chart.categoryLimit && !chart.topN)
      issues.push({
        path,
        message: "too many categories require a top-N plus Other policy.",
      });
    if (chart.topN && chart.topN.count >= chart.categoryLimit)
      issues.push({ path, message: "top-N must leave a visible Other group." });
    if (!chart.topN && labels.length > BAR_MAX_CATEGORIES)
      issues.push({ path, message: "too many visible categories." });
  }
  if (chart.kind === "donut") {
    if (!isCategoricalType(dimension.scalarType))
      issues.push({
        path,
        message: "donut charts require a categorical dimension.",
      });
    if (
      labels.length < DONUT_MIN_SEGMENTS ||
      labels.length > DONUT_MAX_SEGMENTS ||
      labels.length > chart.segmentLimit
    )
      issues.push({
        path,
        message: "donut charts require 2-6 complete segments.",
      });
    if (valuesFor(source, dimension.id).some((value) => value === null))
      issues.push({
        path,
        message: "donut total cannot include rows with a missing dimension.",
      });
    const measureId = chart.aggregation.field.fieldId;
    if (valuesFor(source, measureId).some((value) => value === null))
      issues.push({
        path,
        message: "donut total cannot include rows with a missing measure.",
      });
    const points = calculateChart(source, chart);
    if (points.some((point) => point.value < 0))
      issues.push({ path, message: "donut values must be non-negative." });
    const total = points.reduce((sum, point) => sum + point.value, 0);
    if (total === 0)
      issues.push({ path, message: "donut total must be non-zero." });
    if (points.length !== labels.length)
      issues.push({
        path,
        message: "donut cannot omit categories from its total.",
      });
  }
  return issues;
}

export function isChartSpecificationSupported(
  source: Dataset,
  chart: ChartSpecification,
): boolean {
  return chartIssues(source, chart, "chart").length === 0;
}

function chartStorySignature(chart: ChartSpecification) {
  return `${chart.dimension.fieldId}:${chart.aggregation.kind}:${chart.aggregation.kind === "count" ? "" : chart.aggregation.field.fieldId}`;
}

function supportedChartStoryCount(source: Dataset): number {
  const numericMeasures = source.columns.filter(
    (column) =>
      column.scalarType === "number" &&
      valuesFor(source, column.id).some((value) => typeof value === "number"),
  );
  const stories = new Set<string>();
  const accept = (candidate: ChartSpecification) => {
    const signature = chartStorySignature(candidate);
    if (
      !stories.has(signature) &&
      chartIssues(source, candidate, "candidate").length === 0
    )
      stories.add(signature);
    return stories.size >= 2;
  };
  for (const dimension of source.columns) {
    const kind = isCategoricalType(dimension.scalarType)
      ? "bar"
      : dimension.scalarType === "date"
        ? "line"
        : undefined;
    if (!kind) continue;
    const labelCount = new Set(
      valuesFor(source, dimension.id)
        .filter((value) => value !== null)
        .map(String),
    ).size;
    const topN =
      labelCount > BAR_MAX_CATEGORIES
        ? { count: BAR_MAX_CATEGORIES - 1, includeOther: true as const }
        : undefined;
    const candidateFor = (aggregation: Aggregation): ChartSpecification =>
      kind === "bar"
        ? {
            id: "candidate-bar",
            kind,
            title: "Candidate",
            rationale: "Candidate",
            dimension: { fieldId: dimension.id },
            aggregation,
            categoryLimit: BAR_MAX_CATEGORIES,
            ...(topN ? { topN } : {}),
          }
        : {
            id: "candidate-line",
            kind,
            title: "Candidate",
            rationale: "Candidate",
            dimension: { fieldId: dimension.id },
            aggregation,
            pointLimit: LINE_MAX_POINTS,
            missingPeriodPolicy: "reject",
          };
    if (accept(candidateFor({ kind: "count" }))) return stories.size;
    for (const measure of numericMeasures) {
      if (
        accept(
          candidateFor({
            kind: "sum",
            field: { fieldId: measure.id },
          }),
        )
      )
        return stories.size;
    }
  }
  return stories.size;
}

export function validateTableProposal(
  source: Dataset,
  proposal: AnalysisProposal,
): void {
  const issues: SemanticIssue[] = [];
  for (const [index, metric] of proposal.metrics.entries())
    issues.push(...aggregationIssues(source, metric, `metrics.${index}`));
  if (proposal.outcome === "no-chart" && supportedChartStoryCount(source) >= 2)
    issues.push({
      path: "outcome",
      message:
        "source supports at least two distinct chart stories accepted by the trusted catalog; return a charts outcome.",
    });
  if (proposal.outcome === "charts")
    for (const [index, chart] of proposal.charts.entries())
      issues.push(...chartIssues(source, chart, `charts.${index}`));
  if (proposal.outcome === "charts") {
    const signatures = new Set<string>();
    for (const chart of proposal.charts) {
      const signature = chartStorySignature(chart);
      if (signatures.has(signature))
        issues.push({
          path: "charts",
          message: "charts must not repeat the same dimension and measure.",
        });
      signatures.add(signature);
    }
  }
  if (issues.length) throw new SemanticValidationError(issues);
}
