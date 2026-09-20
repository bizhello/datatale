import { describe, expect, it } from "vitest";
import {
  decodeOutcome,
  decodeQuery,
  providerQueryEnvelopeSchema,
} from "./provider-contract";

const queryWire = {
  outcome: "query" as const,
  answer: "",
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
  calculationValues: [],
  calculationResult: 0,
  calculationUnit: "",
};

describe("provider query wire contract", () => {
  it("keeps a semantically invalid sort available for the repair stage", () => {
    const wire = providerQueryEnvelopeSchema.parse(queryWire);
    const outcome = decodeOutcome(wire);

    expect(() => decodeQuery(outcome, "query-id")).toThrow(
      /exactly one field or metric/i,
    );
  });
});
