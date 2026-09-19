import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  ANALYSIS_TIMEOUT_MS,
  analysisProposalFromProviderOutput,
  MODEL_CALL_TIMEOUT_MS,
  narrativeFromProviderOutput,
  providerAnalysisProposalSchema,
  providerNarrativeResponseSchema,
  providerTextExtractionResponseSchema,
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
    expect(MODEL_CALL_TIMEOUT_MS).toBe(30_000);
    expect(ANALYSIS_TIMEOUT_MS).toBe(75_000);
    expect(ANALYSIS_TIMEOUT_MS).toBeLessThanOrEqual(MODEL_CALL_TIMEOUT_MS * 3);
  });

  it("uses strict JSON schemas without oneOf or optional object properties", () => {
    for (const schema of [
      providerAnalysisProposalSchema,
      providerNarrativeResponseSchema,
      providerTextExtractionResponseSchema,
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
    ).toMatchObject({ hero: [{ text: "Observed." }] });
    expect(
      textExtractionFromProviderOutput({
        facts: [
          {
            id: "fact",
            label: "Revenue",
            value: 12,
            unit: "RUB",
            period: "January",
            paragraphIndex: 1,
            quote: "Revenue was 12 RUB in January.",
          },
        ],
        observations: [],
      }),
    ).toMatchObject({ facts: [{ id: "fact", value: 12 }] });
  });
});
