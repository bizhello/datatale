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
  answer: "",
  answerMode: "quote" as const,
  answerEvidenceIds: [],
  message: "",
  references: [],
  queryId: "",
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
  calculationKind: "none" as const,
  calculationReferenceIds: [],
  calculationEvidenceIds: [],
  calculationValues: [],
  calculationResult: 0,
  calculationUnit: "",
};

describe("provider query wire contract", () => {
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
      groupBy: "date",
      groupByDateBucket: "quarter",
      orderBy: [],
    });
    expect(decodeQuery(wire, "query-id").groupBy).toEqual({
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
    const outcome = decodeOutcome(wire);

    expect(() => decodeQuery(outcome, "query-id")).toThrow(
      /exactly one field or metric/i,
    );
  });
});
