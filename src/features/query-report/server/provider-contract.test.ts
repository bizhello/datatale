import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { datasetQuerySchema } from "@/entities/dataset";
import {
  decodeOutcome,
  decodeQuery,
  providerEnvelopeSchema,
  providerQueryEnvelopeSchema,
} from "./provider-contract";

const queryWire = {
  outcome: "query" as const,
  message: "",
  answerParts: [],
  queries: [
    {
      purpose: "count" as const,
      filters: [],
      groupBy: "city",
      groupByDateBucket: "",
      select: [],
      metrics: [{ id: "total", aggregation: "sum" as const, fieldId: "sales" }],
      orderBy: [
        { fieldId: "sales", metricId: "total", direction: "desc" as const },
      ],
      limit: 1,
    },
  ],
};

describe("provider query wire contract", () => {
  it("documents deterministic sort sentinels and complete grouped evidence", async () => {
    const prompt = await readFile(
      resolve(
        process.cwd(),
        "src/features/query-report/server/prompts/chat.md",
      ),
      "utf8",
    );
    expect(prompt).toContain(
      'metric sort has `fieldId: ""` and a non-empty `metricId`',
    );
    expect(prompt).toContain("Every planned query scope must be represented");
    expect(prompt).toContain("typed group key ID (`...:key`)");
  });

  it("accepts the bounded compound shape and rejects over-limit batches or parts", () => {
    const answer = {
      outcome: "answer" as const,
      message: "",
      queries: [],
      answerParts: Array.from({ length: 8 }, (_, index) => ({
        kind: "values" as const,
        evidenceIds: [`value-${index}`],
        operation: "none" as const,
      })),
    };
    const firstPart = answer.answerParts[0];
    const firstQuery = queryWire.queries[0];
    if (!firstPart || !firstQuery)
      throw new Error("Test fixture is incomplete.");
    expect(() => decodeOutcome(answer)).not.toThrow();
    expect(() =>
      decodeOutcome({
        ...answer,
        answerParts: [...answer.answerParts, firstPart],
      }),
    ).toThrow();
    expect(() =>
      providerEnvelopeSchema.parse({
        ...queryWire,
        queries: Array.from({ length: 5 }, () => firstQuery),
      }),
    ).toThrow();
  });

  it("rejects invalid operations and non-answer parts", () => {
    expect(() =>
      decodeOutcome({
        ...queryWire,
        outcome: "clarification",
        message: "Уточните запрос.",
        queries: [],
        answerParts: [
          { kind: "values", evidenceIds: ["x"], operation: "none" },
        ],
      }),
    ).toThrow();
    expect(() =>
      decodeOutcome({
        outcome: "answer",
        message: "",
        queries: [],
        answerParts: [
          { kind: "values", evidenceIds: ["x"], operation: "difference" },
        ],
      }),
    ).toThrow();
    expect(() =>
      decodeOutcome({
        outcome: "answer",
        message: "",
        queries: [],
        answerParts: [
          {
            kind: "calculation",
            evidenceIds: ["same", "same"],
            operation: "difference",
          },
        ],
      }),
    ).toThrow(/invalid IDs/i);
  });

  it("requires zero answer parts on non-answer outcomes", () => {
    for (const outcome of ["clarification", "unsupported_operation"] as const)
      expect(() =>
        decodeOutcome({
          ...queryWire,
          outcome,
          queries: [],
          message: "Уточните вопрос.",
        }),
      ).not.toThrow();
    expect(() =>
      decodeOutcome({
        ...queryWire,
        outcome: "query",
        answerParts: [
          { kind: "values", evidenceIds: ["x"], operation: "none" },
        ],
      }),
    ).toThrow();
  });

  it("emits a strict required root schema for structured output", async () => {
    const schema = await zodSchema(providerEnvelopeSchema).jsonSchema;
    const properties = Object.keys(schema.properties ?? {});
    expect(schema.required).toEqual(expect.arrayContaining(properties));

    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      expect(value).not.toHaveProperty("anyOf");
      expect(value).not.toHaveProperty("oneOf");
      expect(value).not.toHaveProperty("default");
      for (const child of Object.values(value)) visit(child);
    };
    visit(schema);
  });

  it("decodes a quarterly date bucket into groupBy", () => {
    const wire = providerQueryEnvelopeSchema.parse({
      ...queryWire,
      queries: [
        {
          ...queryWire.queries[0],
          groupBy: "date",
          groupByDateBucket: "quarter",
          orderBy: [],
        },
      ],
    });
    const query = wire.queries[0];
    if (!query) throw new Error("Test fixture is incomplete.");
    expect(decodeQuery(query, "query-id").groupBy).toEqual({
      fieldId: "date",
      dateBucket: "quarter",
    });
  });

  it("rejects date buckets in select", () => {
    expect(
      datasetQuerySchema.safeParse({
        queryId: "query-id",
        select: [{ fieldId: "date", dateBucket: "month" }],
      }).success,
    ).toBe(false);
  });

  it("keeps a semantically invalid sort available for the repair stage", () => {
    const wire = providerQueryEnvelopeSchema.parse(queryWire);
    const query = wire.queries[0];
    if (!query) throw new Error("Test fixture is incomplete.");

    expect(() =>
      decodeQuery(
        {
          ...query,
          orderBy: [{ fieldId: "sales", metricId: "total", direction: "desc" }],
        },
        "query-id",
      ),
    ).toThrow(/exactly one field or metric/i);
  });
});
