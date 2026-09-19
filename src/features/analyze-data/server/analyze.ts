import "server-only";
import { generateText, Output } from "ai";
import type { Dataset, TextSource } from "@/entities/dataset";
import type { AnalysisProposal } from "@/entities/report";
import {
  analysisProposalSchema,
  chartCatalogPromptDescription,
  finalReportSchema,
  narrativeResponseSchema,
} from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";
import { calculateChart, calculateMetric } from "../model/calculate";
import { boundedSourceDescription } from "../model/profile";
import { loadPrompt } from "./prompts";

export class AnalysisError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function validateProposal(
  source: Dataset,
  proposal: ReturnType<typeof analysisProposalSchema.parse>,
) {
  const fields = new Map(source.columns.map((field) => [field.id, field]));
  for (const metric of proposal.metrics)
    if (
      metric.aggregation.kind !== "count" &&
      !fields.has(metric.aggregation.field.fieldId)
    )
      throw new AnalysisError("unsupported-plan", "Unknown metric field.");
  for (const chart of proposal.charts) {
    const dimension = fields.get(chart.dimension.fieldId);
    if (!dimension)
      throw new AnalysisError("unsupported-plan", "Unknown chart dimension.");
    if (chart.kind === "line" && dimension.scalarType !== "date")
      throw new AnalysisError(
        "unsupported-plan",
        "Line charts require a date dimension.",
      );
    if (chart.aggregation.kind !== "count") {
      const measure = fields.get(chart.aggregation.field.fieldId);
      if (measure?.scalarType !== "number")
        throw new AnalysisError(
          "unsupported-plan",
          "Chart aggregation requires a numeric field.",
        );
    }
  }
}

export async function analyzeSource(source: Dataset | TextSource) {
  const model = getAnalysisModel();
  if (!model)
    throw new AnalysisError("unavailable", "Analysis is not configured.");
  if ("rawText" in source) {
    const evidence = source.paragraphs.map((paragraph) => ({
      id: `paragraph-${paragraph.index}`,
      kind: "quote" as const,
      label: `Абзац ${paragraph.index}`,
      excerpt: paragraph.text,
    }));
    return finalReportSchema.parse({
      version: 1,
      hero: [
        {
          text: "Текст принят для анализа, но в этом выпуске он не превращается в диаграммы.",
          evidenceIds: [evidence[0]?.id ?? "paragraph-1"],
        },
      ],
      metrics: [
        {
          id: "paragraphs",
          label: "Абзацев",
          value: source.paragraphs.length,
          evidenceIds: [evidence[0]?.id ?? "paragraph-1"],
        },
      ],
      charts: [],
      evidence,
      recommendations: [],
      noChartReason:
        "Для текста доступны только проверяемые цитаты; связи между абзацами не строятся.",
    });
  }
  const [prompt, description] = await Promise.all([
    loadPrompt("table"),
    Promise.resolve(boundedSourceDescription(source)),
  ]);
  let proposal: AnalysisProposal;
  try {
    const response = await generateText({
      model,
      output: Output.object({ schema: analysisProposalSchema }),
      prompt: `${prompt}\n\nCapabilities:\n${chartCatalogPromptDescription}\n\n${description}`,
      maxRetries: 0,
    });
    proposal = analysisProposalSchema.parse(response.output);
    validateProposal(source, proposal);
  } catch (error) {
    throw new AnalysisError(
      "invalid-model-output",
      error instanceof Error ? error.message : "Invalid model response.",
    );
  }
  const evidence = [
    {
      id: "rows-all",
      kind: "row-range" as const,
      label: `Все ${source.rows.length} строк`,
    },
  ];
  const metrics = proposal.metrics.map((metric) => ({
    ...calculateMetric(source, metric),
    evidenceIds: ["rows-all"],
  }));
  const charts =
    proposal.outcome === "charts"
      ? proposal.charts.map((chart) => ({
          id: chart.id,
          kind: chart.kind,
          title: chart.title,
          rationale: chart.rationale,
          points: calculateChart(source, chart),
          evidenceIds: ["rows-all"],
        }))
      : [];
  const facts = new Set(metrics.map((metric) => metric.id));
  const narrativeResult = await generateText({
    model,
    output: Output.object({ schema: narrativeResponseSchema }),
    prompt: `Write Russian narrative using only these fact IDs and no unlisted numbers: ${JSON.stringify(metrics.map(({ id, label, value }) => ({ id, label, value })))}`,
    maxRetries: 0,
  });
  const narrative = narrativeResponseSchema.parse(narrativeResult.output);
  if (
    [...narrative.hero, ...narrative.recommendations].some((item) =>
      item.factIds.some((id) => !facts.has(id)),
    )
  )
    throw new AnalysisError(
      "invalid-model-output",
      "Narrative referenced an unknown fact.",
    );
  return finalReportSchema.parse({
    version: 1,
    hero: narrative.hero,
    metrics,
    charts,
    evidence,
    recommendations: narrative.recommendations,
    ...(charts.length
      ? {}
      : {
          noChartReason: proposal.reason ?? "Подходящих диаграмм не найдено.",
        }),
  });
}
