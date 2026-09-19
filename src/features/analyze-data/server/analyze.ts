import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Dataset, TextSource } from "@/entities/dataset";
import {
  type AnalysisProposal,
  analysisProposalSchema,
  BAR_MAX_CATEGORIES,
  chartCatalogPromptDescription,
  DONUT_MAX_SEGMENTS,
  DONUT_MIN_SEGMENTS,
  FIELD_REFERENCE_MAX_LENGTH,
  type FinalReport,
  finalReportSchema,
  LINE_MAX_POINTS,
  LINE_MIN_POINTS,
  narrativeResponseSchema,
  REPORT_ID_MAX_LENGTH,
  REPORT_LABEL_MAX_LENGTH,
  REPORT_NARRATIVE_MAX_LENGTH,
  REPORT_NO_CHART_REASON_MAX_LENGTH,
  REPORT_PERIOD_MAX_LENGTH,
  REPORT_QUOTE_MAX_LENGTH,
  REPORT_RATIONALE_MAX_LENGTH,
  REPORT_TITLE_MAX_LENGTH,
  REPORT_UNIT_MAX_LENGTH,
  textExtractionResponseSchema,
} from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";
import {
  calculateChart,
  calculateMetric,
  reportChartCalculation,
} from "../model/calculate";
import { validateFinalReportReferences } from "../model/final-report";
import { boundedSourceDescription } from "../model/profile";
import {
  SemanticValidationError,
  validateTableProposal,
} from "../model/semantic";
import { loadPrompt } from "./prompts";

export class AnalysisError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export type AnalysisStage =
  | "table-plan"
  | "table-repair"
  | "text-extraction"
  | "narrative";
export const MODEL_CALL_TIMEOUT_MS = 30_000;
export const ANALYSIS_TIMEOUT_MS = 75_000;
export const MODEL_OUTPUT_TOKEN_LIMITS: Readonly<
  Record<AnalysisStage, number>
> = {
  "table-plan": 1_200,
  "table-repair": 1_200,
  "text-extraction": 1_800,
  narrative: 1_200,
};
export type ModelCall = (request: {
  stage: AnalysisStage;
  prompt: string;
  schema: z.ZodType;
  providerSchema?: z.ZodType;
  decodeProviderOutput?: (output: unknown) => unknown;
  signal: AbortSignal;
}) => Promise<unknown>;
export type AnalyzeOptions = { callModel?: ModelCall; timeoutMs?: number };

const providerIdentifierString = z.string().min(1).max(REPORT_ID_MAX_LENGTH);
const providerFieldReferenceString = z.string().max(FIELD_REFERENCE_MAX_LENGTH);
const providerLabelString = z.string().min(1).max(REPORT_LABEL_MAX_LENGTH);
const providerTitleString = z.string().min(1).max(REPORT_TITLE_MAX_LENGTH);
const providerRationaleString = z
  .string()
  .min(1)
  .max(REPORT_RATIONALE_MAX_LENGTH);
const providerNarrativeString = z
  .string()
  .min(1)
  .max(REPORT_NARRATIVE_MAX_LENGTH);
const providerUnitString = z.string().min(1).max(REPORT_UNIT_MAX_LENGTH);
const providerPeriodString = z.string().min(1).max(REPORT_PERIOD_MAX_LENGTH);
const providerQuoteString = z.string().min(1).max(REPORT_QUOTE_MAX_LENGTH);

const providerMetricSchema = z
  .object({
    id: providerIdentifierString,
    label: providerLabelString,
    aggregationKind: z.enum(["count", "sum", "average", "min", "max"]),
    aggregationFieldId: providerFieldReferenceString,
  })
  .strict();
const providerChartSchema = z
  .object({
    id: providerIdentifierString,
    kind: z.enum(["bar", "line", "donut"]),
    title: providerTitleString,
    rationale: providerRationaleString,
    dimensionFieldId: providerFieldReferenceString,
    aggregationKind: z.enum(["count", "sum", "average", "min", "max"]),
    aggregationFieldId: providerFieldReferenceString,
    categoryLimit: z
      .number()
      .int()
      .min(0)
      .max(BAR_MAX_CATEGORIES)
      .describe("Bar: 1-12. Line or donut: 0."),
    topNCount: z
      .number()
      .int()
      .min(0)
      .max(BAR_MAX_CATEGORIES - 1)
      .describe("Bar top-N count, otherwise 0."),
    topNIncludeOther: z
      .boolean()
      .describe("True only when bar topNCount is positive."),
    pointLimit: z
      .number()
      .int()
      .min(0)
      .max(LINE_MAX_POINTS)
      .describe("Line: 2-24. Bar or donut: 0."),
    missingPeriodPolicy: z
      .enum(["", "reject"])
      .describe('Line: "reject". Bar or donut: empty string.'),
    segmentLimit: z
      .number()
      .int()
      .min(0)
      .max(DONUT_MAX_SEGMENTS)
      .describe("Donut: 2-6. Bar or line: 0."),
  })
  .strict();
export const providerAnalysisProposalSchema = z
  .object({
    outcome: z.enum(["charts", "no-chart"]),
    reason: z.string().max(REPORT_NO_CHART_REASON_MAX_LENGTH),
    metrics: z.array(providerMetricSchema).min(2).max(4),
    charts: z.array(providerChartSchema).max(3),
  })
  .strict();

const providerNarrativeItemSchema = z
  .object({
    text: providerNarrativeString,
    factIds: z.array(providerIdentifierString).max(4),
    evidenceIds: z.array(providerIdentifierString).max(7),
    kind: z.enum(["observation", "hypothesis", "action"]),
  })
  .strict();
export const providerNarrativeResponseSchema = z
  .object({
    hero: z.array(providerNarrativeItemSchema).min(2).max(3),
    recommendations: z
      .array(providerNarrativeItemSchema.extend({ kind: z.literal("action") }))
      .max(3),
  })
  .strict();
export const providerTextExtractionResponseSchema = z
  .object({
    facts: z
      .array(
        z
          .object({
            id: providerIdentifierString,
            label: providerLabelString,
            value: z.number().finite(),
            unit: providerUnitString,
            period: providerPeriodString,
            paragraphIndex: z.number().int().positive(),
            quote: providerQuoteString,
          })
          .strict(),
      )
      .max(4),
    observations: z
      .array(
        z
          .object({
            id: providerIdentifierString,
            paragraphIndex: z.number().int().positive(),
            quote: providerQuoteString,
          })
          .strict(),
      )
      .max(3),
  })
  .strict();

type ProviderAggregationKind = z.infer<
  typeof providerMetricSchema
>["aggregationKind"];

function invalidProviderOutput(message: string): never {
  throw new AnalysisError("invalid-model-output", message);
}

function aggregationFromProvider(
  kind: ProviderAggregationKind,
  fieldId: string,
) {
  if (kind === "count") {
    if (fieldId !== "")
      invalidProviderOutput(
        "Count aggregations must use an empty field sentinel.",
      );
    return { kind } as const;
  }
  if (fieldId === "")
    invalidProviderOutput("Numeric aggregations must name a source field.");
  return { kind, field: { fieldId } } as const;
}

export function analysisProposalFromProviderOutput(
  output: unknown,
): AnalysisProposal {
  const wire = providerAnalysisProposalSchema.parse(output);
  const metrics = wire.metrics.map((metric) => ({
    id: metric.id,
    label: metric.label,
    aggregation: aggregationFromProvider(
      metric.aggregationKind,
      metric.aggregationFieldId,
    ),
  }));
  if (wire.outcome === "no-chart") {
    if (wire.reason.trim() === "" || wire.charts.length !== 0)
      invalidProviderOutput(
        "No-chart proposals require a reason and empty chart sentinels.",
      );
    return analysisProposalSchema.parse({
      outcome: "no-chart",
      reason: wire.reason,
      metrics,
    });
  }
  if (wire.reason !== "")
    invalidProviderOutput(
      "Chart proposals must use an empty no-chart reason sentinel.",
    );
  const charts = wire.charts.map((chart) => {
    const base = {
      id: chart.id,
      kind: chart.kind,
      title: chart.title,
      rationale: chart.rationale,
      dimension: { fieldId: chart.dimensionFieldId },
      aggregation: aggregationFromProvider(
        chart.aggregationKind,
        chart.aggregationFieldId,
      ),
    };
    switch (chart.kind) {
      case "bar":
        if (chart.categoryLimit === 0)
          invalidProviderOutput(
            "Bar proposals require a positive category limit.",
          );
        if (
          chart.pointLimit !== 0 ||
          chart.missingPeriodPolicy !== "" ||
          chart.segmentLimit !== 0
        )
          invalidProviderOutput(
            "Bar proposals must leave line and donut sentinels empty.",
          );
        if (chart.topNCount === 0 && chart.topNIncludeOther)
          invalidProviderOutput("A bar top-N sentinel cannot include Other.");
        if (chart.topNCount > 0 && !chart.topNIncludeOther)
          invalidProviderOutput("A bar top-N requires Other.");
        return {
          ...base,
          kind: "bar" as const,
          categoryLimit: chart.categoryLimit,
          ...(chart.topNCount > 0
            ? {
                topN: {
                  count: chart.topNCount,
                  includeOther: true as const,
                },
              }
            : {}),
        };
      case "line":
        if (
          chart.pointLimit < LINE_MIN_POINTS ||
          chart.missingPeriodPolicy !== "reject"
        )
          invalidProviderOutput(
            "Line proposals require a valid point limit and reject missing periods.",
          );
        if (
          chart.categoryLimit !== 0 ||
          chart.topNCount !== 0 ||
          chart.topNIncludeOther ||
          chart.segmentLimit !== 0
        )
          invalidProviderOutput(
            "Line proposals must leave bar and donut sentinels empty.",
          );
        return {
          ...base,
          kind: "line" as const,
          pointLimit: chart.pointLimit,
          missingPeriodPolicy: chart.missingPeriodPolicy,
        };
      case "donut":
        if (chart.segmentLimit < DONUT_MIN_SEGMENTS)
          invalidProviderOutput(
            "Donut proposals require a valid segment limit.",
          );
        if (
          chart.categoryLimit !== 0 ||
          chart.topNCount !== 0 ||
          chart.topNIncludeOther ||
          chart.pointLimit !== 0 ||
          chart.missingPeriodPolicy !== ""
        )
          invalidProviderOutput(
            "Donut proposals must leave bar and line sentinels empty.",
          );
        return {
          ...base,
          kind: "donut" as const,
          segmentLimit: chart.segmentLimit,
        };
      default:
        return invalidProviderOutput("Unsupported chart kind.");
    }
  });
  return analysisProposalSchema.parse({
    outcome: "charts",
    charts,
    metrics,
  });
}

export function narrativeFromProviderOutput(output: unknown) {
  return narrativeResponseSchema.parse(
    providerNarrativeResponseSchema.parse(output),
  );
}

export function textExtractionFromProviderOutput(output: unknown) {
  return textExtractionResponseSchema.parse(
    providerTextExtractionResponseSchema.parse(output),
  );
}

function defaultCallModel(): ModelCall {
  const model = getAnalysisModel();
  if (!model)
    throw new AnalysisError("unavailable", "Analysis is not configured.");
  return async ({
    stage,
    prompt,
    schema,
    providerSchema = schema,
    decodeProviderOutput = (output) => output,
    signal,
  }) => {
    const response = await generateText({
      model,
      output: Output.object({ schema: providerSchema }),
      prompt,
      maxRetries: 0,
      maxOutputTokens: MODEL_OUTPUT_TOKEN_LIMITS[stage],
      abortSignal: signal,
      timeout: MODEL_CALL_TIMEOUT_MS,
    });
    return decodeProviderOutput(response.output);
  };
}
function checkedNarrative(
  response: unknown,
  facts: Set<string>,
  evidence: Set<string>,
) {
  const narrative = narrativeResponseSchema.parse(response);
  for (const item of [...narrative.hero, ...narrative.recommendations]) {
    if (
      item.factIds.some((id) => !facts.has(id)) ||
      item.evidenceIds.some((id) => !evidence.has(id))
    ) {
      throw new AnalysisError(
        "invalid-model-output",
        "Narrative referenced an unchecked fact or evidence item.",
      );
    }
  }
  return narrative;
}
function tableEvidence(source: Dataset) {
  return [
    {
      id: "rows-all",
      kind: "row-range" as const,
      label: `All ${source.rows.length} accepted rows`,
      coverage: { included: source.rows.length, total: source.rows.length },
    },
  ];
}
function reportFromTable(
  source: Dataset,
  proposal: AnalysisProposal,
  narrative: ReturnType<typeof narrativeResponseSchema.parse>,
): FinalReport {
  const evidence = tableEvidence(source);
  const metrics = proposal.metrics.map((metric) => ({
    ...calculateMetric(source, metric),
    evidenceIds: ["rows-all"],
  }));
  const charts =
    proposal.outcome === "charts"
      ? proposal.charts.map((chart) => {
          const aggregation = chart.aggregation;
          const numeric =
            "field" in aggregation
              ? source.columns.find(
                  (column) => column.id === aggregation.field.fieldId,
                )
              : undefined;
          return {
            id: chart.id,
            kind: chart.kind,
            title: chart.title,
            rationale: chart.rationale,
            aggregation: reportChartCalculation(
              source,
              chart.aggregation,
              chart.dimension.fieldId,
            ),
            points: calculateChart(source, chart),
            evidenceIds: ["rows-all"],
            ...(numeric?.unit ? { unit: numeric.unit } : {}),
          };
        })
      : [];
  return finalReportSchema.parse({
    version: 1,
    hero: narrative.hero,
    metrics,
    charts,
    evidence,
    recommendations: narrative.recommendations,
    ...(proposal.outcome === "no-chart"
      ? { noChartReason: proposal.reason }
      : {}),
  });
}
const numericTokenPattern =
  /[+\-−]?(?:\d{1,3}(?:[ \u00a0\u202f'’.,]\d{3})+|\d+)(?:[.,]\d+)?/g;

function canonicalNumericToken(token: string): number | undefined {
  const normalizedSign = token.startsWith("−") ? "-" : token[0];
  const sign =
    normalizedSign === "+" || normalizedSign === "-" ? normalizedSign : "";
  const unsigned = sign ? token.slice(1) : token;
  const compact = unsigned.replace(/[ \u00a0\u202f'’]/g, "");
  const dots = [...compact.matchAll(/\./g)].map((match) => match.index ?? 0);
  const commas = [...compact.matchAll(/,/g)].map((match) => match.index ?? 0);

  if (dots.length === 0 && commas.length === 0)
    return Number(`${sign}${compact}`);

  if (dots.length > 0 && commas.length > 0) {
    const decimalIndex = Math.max(dots.at(-1) ?? 0, commas.at(-1) ?? 0);
    const whole = compact.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fraction = compact.slice(decimalIndex + 1);
    return /^\d+$/.test(whole) && /^\d+$/.test(fraction)
      ? Number(`${sign}${whole}.${fraction}`)
      : undefined;
  }

  const separator = dots.length > 0 ? "." : ",";
  const parts = compact.split(separator);
  if (parts.length === 2 && parts[1]?.length !== 3)
    return Number(`${sign}${parts[0]}.${parts[1]}`);
  if (parts.length > 2 && parts.slice(1).every((part) => part.length === 3))
    return Number(`${sign}${parts.join("")}`);

  // A lone separator followed by exactly three digits is locale-ambiguous
  // (for example, "1,234"). Rejecting it prevents a false grounding match.
  return undefined;
}

function quoteHasValue(quote: string, value: number): boolean {
  for (const match of quote.matchAll(numericTokenPattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    const before = quote[start - 1] ?? "";
    const after = quote[start + token.length] ?? "";
    if (/^[\p{L}\p{N}_]$/u.test(before) || /^[\p{L}\p{N}_]$/u.test(after))
      continue;
    if (Object.is(canonicalNumericToken(token), value)) return true;
  }
  return false;
}

const semanticCharacter = /^[\p{L}\p{N}_]$/u;
function quoteHasExactPhrase(quote: string, phrase: string): boolean {
  const [first] = Array.from(phrase);
  const last = Array.from(phrase).at(-1);
  let start = quote.indexOf(phrase);
  while (start !== -1) {
    const before = quote[start - 1] ?? "";
    const after = quote[start + phrase.length] ?? "";
    const leftIsBounded =
      !first?.match(semanticCharacter) || !before.match(semanticCharacter);
    const rightIsBounded =
      !last?.match(semanticCharacter) || !after.match(semanticCharacter);
    if (leftIsBounded && rightIsBounded) return true;
    start = quote.indexOf(phrase, start + 1);
  }
  return false;
}

function boundedExactExcerpt(text: string) {
  const excerpt = text.slice(0, REPORT_QUOTE_MAX_LENGTH);
  return /[\uD800-\uDBFF]$/.test(excerpt) ? excerpt.slice(0, -1) : excerpt;
}
async function analyzeText(
  source: TextSource,
  callModel: ModelCall,
  signal: AbortSignal,
): Promise<FinalReport> {
  const [extractPrompt, narrativePrompt] = await Promise.all([
    loadPrompt("text"),
    loadPrompt("narrative"),
  ]);
  const extraction = textExtractionResponseSchema.parse(
    await callModel({
      stage: "text-extraction",
      schema: textExtractionResponseSchema,
      providerSchema: providerTextExtractionResponseSchema,
      decodeProviderOutput: textExtractionFromProviderOutput,
      signal,
      prompt: `${extractPrompt}\n\n${boundedSourceDescription(source)}`,
    }),
  );
  const usedQuotes = new Set<string>();
  const evidence = [] as Array<{
    id: string;
    kind: "quote";
    label: string;
    excerpt: string;
  }>;
  const addQuoteEvidence = (
    id: string,
    paragraphIndex: number,
    quote: string,
  ) => {
    usedQuotes.add(quote);
    evidence.push({
      id: `quote-${id}`,
      kind: "quote",
      label: `Paragraph ${paragraphIndex}`,
      excerpt: quote,
    });
  };
  const facts = extraction.facts
    .map((fact) => {
      const paragraph = source.paragraphs.find(
        (candidate) => candidate.index === fact.paragraphIndex,
      );
      if (!paragraph?.text.includes(fact.quote) || usedQuotes.has(fact.quote))
        throw new AnalysisError(
          "invalid-model-output",
          "Text fact must use one exact, unused paragraph quotation.",
        );
      const grounded =
        quoteHasValue(fact.quote, fact.value) &&
        quoteHasExactPhrase(fact.quote, fact.unit) &&
        quoteHasExactPhrase(fact.quote, fact.period);
      // A provider can preserve the source quote while slightly paraphrasing a
      // numeric field. Keep the exact quote as evidence, but never promote the
      // ungrounded number to a metric.
      const evidenceId = `quote-${fact.id}`;
      addQuoteEvidence(fact.id, fact.paragraphIndex, fact.quote);
      if (!grounded) return undefined;
      return {
        id: fact.id,
        label: fact.label,
        value: fact.value,
        calculation: { kind: "direct-source" as const },
        ...(fact.unit ? { unit: fact.unit } : {}),
        evidenceIds: [evidenceId],
      };
    })
    .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined);
  for (const observation of extraction.observations) {
    const paragraph = source.paragraphs.find(
      (candidate) => candidate.index === observation.paragraphIndex,
    );
    if (
      !paragraph?.text.includes(observation.quote) ||
      usedQuotes.has(observation.quote)
    )
      throw new AnalysisError(
        "invalid-model-output",
        "Text observation must use one exact, unused paragraph quotation.",
      );
    usedQuotes.add(observation.quote);
    evidence.push({
      id: `quote-${observation.id}`,
      kind: "quote",
      label: `Paragraph ${observation.paragraphIndex}`,
      excerpt: observation.quote,
    });
  }
  if (!evidence.length) {
    const paragraph = source.paragraphs[0];
    if (!paragraph)
      throw new AnalysisError(
        "invalid-source",
        "Text source has no paragraphs.",
      );
    evidence.push({
      id: "quote-source",
      kind: "quote",
      label: `Paragraph ${paragraph.index}`,
      excerpt: boundedExactExcerpt(paragraph.text),
    });
  }
  const factIds = new Set(facts.map((fact) => fact.id));
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const narrative = checkedNarrative(
    await callModel({
      stage: "narrative",
      schema: narrativeResponseSchema,
      providerSchema: providerNarrativeResponseSchema,
      decodeProviderOutput: narrativeFromProviderOutput,
      signal,
      prompt: `${narrativePrompt}\n\nChecked facts and evidence only:\n${JSON.stringify({ facts, evidence })}`,
    }),
    factIds,
    evidenceIds,
  );
  return finalReportSchema.parse({
    version: 1,
    hero: narrative.hero,
    metrics: facts,
    charts: [],
    evidence,
    recommendations: narrative.recommendations,
    noChartReason:
      "Text analysis uses only exact, checked quotations; it does not create synthetic table relationships.",
  });
}
export async function analyzeSource(
  source: Dataset | TextSource,
  options: AnalyzeOptions = {},
): Promise<FinalReport> {
  const callModel = options.callModel ?? defaultCallModel();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ANALYSIS_TIMEOUT_MS,
  );
  try {
    if ("rawText" in source)
      return validateFinalReportReferences(
        await analyzeText(source, callModel, controller.signal),
      );
    const [planPrompt, narrativePrompt] = await Promise.all([
      loadPrompt("table"),
      loadPrompt("narrative"),
    ]);
    const sourceDescription = boundedSourceDescription(source);
    let proposal: AnalysisProposal;
    try {
      proposal = analysisProposalSchema.parse(
        await callModel({
          stage: "table-plan",
          schema: analysisProposalSchema,
          providerSchema: providerAnalysisProposalSchema,
          decodeProviderOutput: analysisProposalFromProviderOutput,
          signal: controller.signal,
          prompt: `${planPrompt}\n\nCapabilities:\n${chartCatalogPromptDescription}\n\n${sourceDescription}`,
        }),
      );
      validateTableProposal(source, proposal);
    } catch (error) {
      if (!(error instanceof SemanticValidationError)) throw error;
      proposal = analysisProposalSchema.parse(
        await callModel({
          stage: "table-repair",
          schema: analysisProposalSchema,
          providerSchema: providerAnalysisProposalSchema,
          decodeProviderOutput: analysisProposalFromProviderOutput,
          signal: controller.signal,
          prompt: `${planPrompt}\n\nRepair the previous proposal. Resolve only these concrete semantic errors: ${error.message}\n\nCapabilities:\n${chartCatalogPromptDescription}\n\n${sourceDescription}`,
        }),
      );
      try {
        validateTableProposal(source, proposal);
      } catch (secondError) {
        throw new AnalysisError(
          "unsupported-plan",
          secondError instanceof Error
            ? secondError.message
            : "Repaired proposal is invalid.",
        );
      }
    }
    const metrics = proposal.metrics.map((metric) => ({
      ...calculateMetric(source, metric),
      evidenceIds: ["rows-all"],
    }));
    const narrative = checkedNarrative(
      await callModel({
        stage: "narrative",
        schema: narrativeResponseSchema,
        providerSchema: providerNarrativeResponseSchema,
        decodeProviderOutput: narrativeFromProviderOutput,
        signal: controller.signal,
        prompt: `${narrativePrompt}\n\nChecked facts only; do not add values:\n${JSON.stringify({ facts: metrics, evidence: tableEvidence(source) })}`,
      }),
      new Set(metrics.map((metric) => metric.id)),
      new Set(["rows-all"]),
    );
    return validateFinalReportReferences(
      reportFromTable(source, proposal, narrative),
    );
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (controller.signal.aborted)
      throw new AnalysisError("timeout", "Analysis deadline exceeded.");
    if (error instanceof z.ZodError)
      throw new AnalysisError("invalid-model-output", error.message);
    throw new AnalysisError(
      "provider",
      error instanceof Error ? error.message : "Provider request failed.",
    );
  } finally {
    clearTimeout(timer);
  }
}
