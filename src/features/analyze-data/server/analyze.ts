import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Dataset, TextSource } from "@/entities/dataset";
import {
  type AnalysisProposal,
  analysisProposalSchema,
  chartCatalogPromptDescription,
  type FinalReport,
  finalReportSchema,
  narrativeResponseSchema,
  REPORT_QUOTE_MAX_LENGTH,
  textExtractionResponseSchema,
} from "@/entities/report";
import { getAnalysisModel } from "@/shared/lib/ai";
import { calculateChart, calculateMetric } from "../model/calculate";
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
export const MODEL_CALL_TIMEOUT_MS = 15_000;
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
  signal: AbortSignal;
}) => Promise<unknown>;
export type AnalyzeOptions = { callModel?: ModelCall; timeoutMs?: number };

function defaultCallModel(): ModelCall {
  const model = getAnalysisModel();
  if (!model)
    throw new AnalysisError("unavailable", "Analysis is not configured.");
  return async ({ stage, prompt, schema, signal }) => {
    const response = await generateText({
      model,
      output: Output.object({ schema }),
      prompt,
      maxRetries: 0,
      maxOutputTokens: MODEL_OUTPUT_TOKEN_LIMITS[stage],
      abortSignal: signal,
      timeout: MODEL_CALL_TIMEOUT_MS,
    });
    return response.output;
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
  const facts = extraction.facts.map((fact) => {
    const paragraph = source.paragraphs.find(
      (candidate) => candidate.index === fact.paragraphIndex,
    );
    if (
      !paragraph?.text.includes(fact.quote) ||
      usedQuotes.has(fact.quote) ||
      !quoteHasValue(fact.quote, fact.value) ||
      !quoteHasExactPhrase(fact.quote, fact.unit) ||
      !quoteHasExactPhrase(fact.quote, fact.period)
    )
      throw new AnalysisError(
        "invalid-model-output",
        "Text fact must use one exact, unused paragraph quotation containing its value, unit, and period.",
      );
    usedQuotes.add(fact.quote);
    const evidenceId = `quote-${fact.id}`;
    evidence.push({
      id: evidenceId,
      kind: "quote",
      label: `Paragraph ${fact.paragraphIndex}`,
      excerpt: fact.quote,
    });
    return {
      id: fact.id,
      label: fact.label,
      value: fact.value,
      ...(fact.unit ? { unit: fact.unit } : {}),
      evidenceIds: [evidenceId],
    };
  });
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
    options.timeoutMs ?? 30_000,
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
