import { describe, expect, it } from "vitest";
import { datasetQuerySchema } from "@/entities/dataset";
import {
  decodeOutcome,
  decodeQuery,
  providerQueryEnvelopeSchema,
} from "./provider-contract";

const queryWire = {
  outcome: "query" as const,
  answer: "",
  answerMode: "quote" as const,
  answerEvidenceIds: [],
  answerSpanStart: -1,
  answerSpanEnd: -1,
  message: "",
  references: [],
  queryId: "",
  filters: [],
  groupBy: "city",
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
