import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  ANALYSIS_TIMEOUT_MS,
  analysisProposalFromProviderOutput,
  DEFAULT_TEXT_EXTRACTION_MODEL,
  MODEL_CALL_TIMEOUT_MS,
  MODEL_OUTPUT_TOKEN_LIMITS,
  narrativeFromProviderOutput,
  providerAnalysisProposalSchema,
  providerNarrativeResponseSchema,
  providerOptionsForStage,
  providerTextExtractionResponseSchema,
  providerTextReportResponseSchema,
  TEXT_EXTRACTION_MODEL_CALL_TIMEOUT_MS,
  TEXT_EXTRACTION_REASONING_EFFORT,
  textExtractionFromProviderOutput,
} from "./analyze";

function expectStrictProviderSchema(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) expectStrictProviderSchema(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const schema = value as Record<string, unknown>;
  expect(schema).not.toHaveProperty("oneOf");
  const properties = schema.properties;
  if (typeof properties === "object" && properties !== null) {
    const propertyNames = Object.keys(properties);
    expect(schema.required).toEqual(expect.arrayContaining(propertyNames));
  }
  for (const nested of Object.values(schema))
    expectStrictProviderSchema(nested);
}

const providerProposal = {
  outcome: "charts",
  reason: "",
  metrics: [
    {
      id: "total",
      label: "Total",
      aggregationKind: "sum",
      aggregationFieldId: "revenue",
    },
    {
      id: "orders",
      label: "Orders",
      aggregationKind: "count",
      aggregationFieldId: "",
    },
  ],
  charts: [
    {
      id: "bar",
      kind: "bar",
      title: "By region",
      rationale: "Comparison",
      dimensionFieldId: "region",
      aggregationKind: "sum",
      aggregationFieldId: "revenue",
      categoryLimit: 12,
      topNCount: 0,
      topNIncludeOther: false,
      pointLimit: 0,
      missingPeriodPolicy: "",
      segmentLimit: 0,
    },
    {
      id: "line",
      kind: "line",
      title: "Trend",
      rationale: "Time",
      dimensionFieldId: "month",
      aggregationKind: "sum",
      aggregationFieldId: "revenue",
      categoryLimit: 0,
      topNCount: 0,
      topNIncludeOther: false,
      pointLimit: 24,
      missingPeriodPolicy: "reject",
      segmentLimit: 0,
    },
  ],
} as const;

describe("provider-facing structured output", () => {
  it("keeps a bounded timeout budget for the three-stage repair flow", () => {
    expect(MODEL_CALL_TIMEOUT_MS).toBe(45_000);
    expect(TEXT_EXTRACTION_MODEL_CALL_TIMEOUT_MS).toBe(75_000);
    expect(ANALYSIS_TIMEOUT_MS).toBe(165_000);
    expect(DEFAULT_TEXT_EXTRACTION_MODEL).toBe("gpt-5.6-luna");
    expect(TEXT_EXTRACTION_REASONING_EFFORT).toBe("low");
    expect(providerOptionsForStage("text-extraction")).toEqual({
      openai: { reasoningEffort: "low" },
    });
    expect(providerOptionsForStage("narrative")).toEqual({});
    expect(ANALYSIS_TIMEOUT_MS).toBeLessThanOrEqual(
      TEXT_EXTRACTION_MODEL_CALL_TIMEOUT_MS + MODEL_CALL_TIMEOUT_MS * 2,
    );
  });

  it("keeps structured outputs compact for every stage", () => {
    expect(MODEL_OUTPUT_TOKEN_LIMITS["text-extraction"]).toBe(2_200);
  });

  it("uses strict JSON schemas without oneOf or optional object properties", () => {
    for (const schema of [
      providerAnalysisProposalSchema,
      providerNarrativeResponseSchema,
      providerTextExtractionResponseSchema,
      providerTextReportResponseSchema,
    ])
      expectStrictProviderSchema(z.toJSONSchema(schema));
  });

  it("converts flat provider proposal sentinels into the strict domain proposal", () => {
    expect(analysisProposalFromProviderOutput(providerProposal)).toEqual({
      outcome: "charts",
      metrics: [
        {
          id: "total",
          label: "Total",
          aggregation: { kind: "sum", field: { fieldId: "revenue" } },
        },
        { id: "orders", label: "Orders", aggregation: { kind: "count" } },
      ],
      charts: [
        {
          id: "bar",
          kind: "bar",
          title: "By region",
          rationale: "Comparison",
          dimension: { fieldId: "region" },
          aggregation: { kind: "sum", field: { fieldId: "revenue" } },
          categoryLimit: 12,
        },
        {
          id: "line",
          kind: "line",
          title: "Trend",
          rationale: "Time",
          dimension: { fieldId: "month" },
          aggregation: { kind: "sum", field: { fieldId: "revenue" } },
          pointLimit: 24,
          missingPeriodPolicy: "reject",
        },
      ],
    });
  });

  it("rejects incompatible sentinels before domain calculation", () => {
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          { ...providerProposal.charts[0], topNIncludeOther: true },
          providerProposal.charts[1],
        ],
      }),
    ).toThrow(/cannot include Other/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        metrics: [
          { ...providerProposal.metrics[1], aggregationFieldId: "revenue" },
          providerProposal.metrics[0],
        ],
      }),
    ).toThrow(/empty field sentinel/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        reason: "There might be no chart.",
      }),
    ).toThrow(/empty no-chart reason sentinel/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          { ...providerProposal.charts[0], pointLimit: 12 },
          providerProposal.charts[1],
        ],
      }),
    ).toThrow(/leave line and donut sentinels empty/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          providerProposal.charts[0],
          { ...providerProposal.charts[1], categoryLimit: 12 },
        ],
      }),
    ).toThrow(/leave bar and donut sentinels empty/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          {
            ...providerProposal.charts[0],
            id: "donut",
            kind: "donut",
            categoryLimit: 0,
            pointLimit: 1,
            segmentLimit: 6,
          },
          providerProposal.charts[1],
        ],
      }),
    ).toThrow(/leave bar and line sentinels empty/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          { ...providerProposal.charts[0], categoryLimit: 0 },
          providerProposal.charts[1],
        ],
      }),
    ).toThrow(/positive category limit/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          providerProposal.charts[0],
          { ...providerProposal.charts[1], pointLimit: 0 },
        ],
      }),
    ).toThrow(/valid point limit/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          providerProposal.charts[0],
          { ...providerProposal.charts[1], missingPeriodPolicy: "" },
        ],
      }),
    ).toThrow(/valid point limit/);
    expect(() =>
      analysisProposalFromProviderOutput({
        ...providerProposal,
        charts: [
          {
            ...providerProposal.charts[0],
            id: "donut",
            kind: "donut",
            categoryLimit: 0,
            segmentLimit: 0,
          },
          providerProposal.charts[1],
        ],
      }),
    ).toThrow(/valid segment limit/);
  });

  it("converts fully required narrative and text wire objects", () => {
    expect(
      narrativeFromProviderOutput({
        hero: [
          {
            text: "Observed.",
            factIds: ["fact"],
            evidenceIds: [],
            kind: "observation",
          },
          {
            text: "Confirmed.",
            factIds: ["fact"],
            evidenceIds: [],
            kind: "observation",
          },
        ],
        recommendations: [
          {
            text: "Act.",
            factIds: [],
            evidenceIds: ["evidence"],
            kind: "action",
          },
        ],
      }),
    ).toMatchObject({
      hero: [{ text: "Observed." }, { text: "Confirmed." }],
    });
    expect(
      textExtractionFromProviderOutput({
        observations: [
          {
            id: "fact",
            subject: "Revenue",
            value: 12,
            unit: "RUB",
            period: "January",
            role: "snapshot",
            paragraphIndex: 1,
            quote: "Revenue was 12 RUB in January.",
          },
        ],
        chartGroups: [],
      }),
    ).toMatchObject({ observations: [{ id: "fact", value: 12 }] });
  });

  it("accepts nullable-period source observations with explicit roles", () => {
    expect(
      textExtractionFromProviderOutput({
        observations: [
          {
            id: "dogs",
            subject: "dogs",
            value: 5,
            unit: null,
            period: null,
            role: "snapshot",
            paragraphIndex: 1,
            quote: "There were 5 dogs.",
          },
        ],
        chartGroups: [
          {
            id: "animals",
            kind: "bar",
            title: "Животные",
            rationale: "Сравнение",
            observationIds: ["dogs", "cats"],
            derivation: "direct",
            operation: "none",
          },
        ],
      }),
    ).toMatchObject({
      observations: [{ subject: "dogs", role: "snapshot" }],
      chartGroups: [{ observationIds: ["dogs", "cats"] }],
    });
  });

  it("allows the complete eight-observation chart evidence bound", () => {
    const observations = Array.from({ length: 8 }, (_, index) => ({
      id: `metric-${index + 1}`,
      subject: `Metric ${index + 1}`,
      value: index + 1,
      unit: null,
      period: null,
      role: "snapshot" as const,
      paragraphIndex: index + 1,
      quote: `Metric ${index + 1}: ${index + 1}`,
    }));
    const output = textExtractionFromProviderOutput({
      observations,
      chartGroups: [
        {
          id: "all",
          kind: "bar",
          title: "All metrics",
          rationale: "Comparison",
          observationIds: observations.map((item) => item.id),
          derivation: "direct",
          operation: "none",
        },
      ],
    });
    expect(output.chartGroups[0]?.observationIds).toHaveLength(8);
    expect(() =>
      textExtractionFromProviderOutput({
        observations,
        chartGroups: [
          {
            id: "too-many",
            kind: "bar",
            title: "Too many",
            rationale: "Boundary",
            observationIds: [...observations.map((item) => item.id), "extra"],
            derivation: "direct",
            operation: "none",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate observation IDs in a provider chart group", () => {
    expect(() =>
      textExtractionFromProviderOutput({
        observations: [
          {
            id: "a",
            subject: "A",
            value: 1,
            unit: null,
            period: null,
            role: "snapshot",
            paragraphIndex: 1,
            quote: "A: 1",
          },
          {
            id: "target",
            subject: "Target",
            value: 2,
            unit: null,
            period: null,
            role: "target",
            paragraphIndex: 1,
            quote: "Target: 2",
          },
        ],
        chartGroups: [
          {
            id: "duplicate",
            kind: "bar",
            title: "Duplicate",
            rationale: "Invalid",
            observationIds: ["a", "a", "target"],
            derivation: "current-target",
            operation: "none",
          },
        ],
      }),
    ).toThrow();
  });

  it("keeps qualitative quotations without inventing numeric fields", () => {
    expect(
      textExtractionFromProviderOutput({
        observations: [
          {
            id: "direct-observation",
            subject: null,
            value: null,
            unit: null,
            period: null,
            role: null,
            paragraphIndex: 1,
            quote: "Команда отметила задержку согласования.",
          },
        ],
        chartGroups: [],
      }),
    ).toMatchObject({ observations: [{ value: null, role: null }] });
  });

  it("rejects a one-sentence hero before it can reach the dashboard", () => {
    expect(() =>
      narrativeFromProviderOutput({
        hero: [
          {
            text: "Only one sentence.",
            factIds: ["fact"],
            evidenceIds: [],
            kind: "observation",
          },
        ],
        recommendations: [],
      }),
    ).toThrow();
  });
});
