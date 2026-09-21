import { z } from "zod";
import { CHAT_ANSWER_MAX_LENGTH } from "@/entities/chat";
import { type DatasetQuery, datasetQuerySchema } from "@/entities/dataset";
import { MAX_ARITHMETIC_OPERANDS } from "./arithmetic";

/* One flat, all-required envelope avoids oneOf/anyOf in the Spiro JSON schema. */
export const providerEnvelopeSchema = z
  .object({
    outcome: z.enum([
      "answer",
      "clarification",
      "not_in_source",
      "unsupported_operation",
      "query",
    ]),
    answer: z.string().max(CHAT_ANSWER_MAX_LENGTH),
    answerMode: z.enum(["quote", "values", "calculation"]),
    answerEvidenceIds: z.array(z.string().max(160)).max(8),
    message: z.string().max(CHAT_ANSWER_MAX_LENGTH),
    references: z
      .array(
        z
          .object({ id: z.string().max(160), excerpt: z.string().max(1_000) })
          .strict(),
      )
      .max(7),
    queryId: z.string().max(160),
    purpose: z.enum(["lookup", "count"]).default("count"),
    filters: z
      .array(
        z
          .object({
            fieldId: z.string().max(160),
            operator: z.enum([
              "eq",
              "ne",
              "in",
              "lt",
              "lte",
              "gt",
              "gte",
              "contains",
            ]),
            valueKind: z.enum([
              "string",
              "number",
              "boolean",
              "null",
              "string_list",
              "number_list",
              "boolean_list",
              "null_list",
            ]),
            values: z.array(z.string().max(160)).max(100),
          })
          .strict(),
      )
      .max(20),
    groupBy: z.string().max(160),
    groupByDateBucket: z
      .enum(["day", "month", "quarter", "year"])
      .or(z.literal(""))
      .default(""),
    select: z.array(z.string().max(160)).max(30),
    metrics: z
      .array(
        z
          .object({
            id: z.string().max(160),
            aggregation: z.enum([
              "count",
              "sum",
              "average",
              "min",
              "max",
              "distinctCount",
            ]),
            fieldId: z.string().max(160),
          })
          .strict(),
      )
      .max(20),
    // DatasetQuery owns semantic exclusivity so one repair call can inspect a malformed draft.
    orderBy: z
      .array(
        z
          .object({
            fieldId: z.string().max(160),
            metricId: z.string().max(160),
            direction: z.enum(["asc", "desc"]),
          })
          .strict(),
      )
      .max(20),
    limit: z.number().int().min(0).max(100),
    calculationKind: z.enum([
      "none",
      "sum",
      "difference",
      "ratio",
      "percentage_of",
      "percentage_change",
    ]),
    calculationReferenceIds: z
      .array(z.string().max(160))
      .max(MAX_ARITHMETIC_OPERANDS),
    calculationEvidenceIds: z
      .array(z.string().max(160))
      .max(MAX_ARITHMETIC_OPERANDS),
    calculationValues: z
      .array(z.number().finite())
      .max(MAX_ARITHMETIC_OPERANDS),
    calculationResult: z.number().finite(),
    calculationUnit: z.string().max(80),
  })
  .strict();
export const providerQueryEnvelopeSchema = providerEnvelopeSchema.extend({
  outcome: z.literal("query"),
});
export type ProviderEnvelope = z.output<typeof providerEnvelopeSchema>;

function decodeValue(
  filter: ProviderEnvelope["filters"][number],
): string | number | boolean | null | Array<string | number | boolean | null> {
  const list = filter.valueKind.endsWith("_list");
  if (
    (list && filter.values.length < 1) ||
    (!list && filter.values.length !== 1)
  )
    throw new Error("Filter valueKind and values do not agree.");
  const parse = (value: string): string | number | boolean | null => {
    if (filter.valueKind.startsWith("number")) {
      const number = Number(value);
      if (!Number.isFinite(number))
        throw new Error("Filter number is invalid.");
      return number;
    }
    if (filter.valueKind.startsWith("boolean")) {
      if (value !== "true" && value !== "false")
        throw new Error("Filter boolean is invalid.");
      return value === "true";
    }
    if (filter.valueKind.startsWith("null")) {
      if (value !== "") throw new Error("Filter null sentinel is invalid.");
      return null;
    }
    return value;
  };
  return list ? filter.values.map(parse) : parse(filter.values[0] as string);
}

export function decodeQuery(
  input: ProviderEnvelope,
  applicationQueryId: string,
): DatasetQuery {
  if (input.outcome !== "query") throw new Error("Expected a query outcome.");
  if (
    !input.limit ||
    input.answer ||
    input.message ||
    input.references.length ||
    input.calculationKind !== "none" ||
    input.calculationReferenceIds.length ||
    input.calculationEvidenceIds.length ||
    input.calculationValues.length ||
    input.calculationResult !== 0 ||
    input.calculationUnit
  )
    throw new Error("Query outcome contains invalid sentinels.");
  if (!input.groupBy && input.groupByDateBucket)
    throw new Error("A date bucket requires groupBy.");
  return datasetQuerySchema.parse({
    queryId: applicationQueryId,
    purpose: input.purpose,
    filters: input.filters.map((filter) => ({
      fieldId: filter.fieldId,
      operator: filter.operator,
      value: decodeValue(filter),
    })),
    groupBy: input.groupBy
      ? {
          fieldId: input.groupBy,
          ...(input.groupByDateBucket
            ? { dateBucket: input.groupByDateBucket }
            : {}),
        }
      : undefined,
    select: input.select,
    metrics: input.metrics.map((metric) => ({
      ...metric,
      fieldId: metric.fieldId || undefined,
    })),
    orderBy: input.orderBy.map((order) => ({
      ...order,
      fieldId: order.fieldId || undefined,
      metricId: order.metricId || undefined,
    })),
    limit: input.limit,
  });
}

export function decodeOutcome(raw: unknown): ProviderEnvelope {
  const output = providerEnvelopeSchema.parse(raw);
  if (
    output.outcome !== "answer" &&
    (output.calculationKind !== "none" ||
      output.calculationReferenceIds.length > 0 ||
      output.calculationEvidenceIds.length > 0 ||
      output.calculationValues.length > 0 ||
      output.calculationResult !== 0 ||
      output.calculationUnit !== "")
  )
    throw new Error("Non-answer outcome contains calculation fields.");
  if (
    output.outcome !== "answer" &&
    (output.answerMode !== "quote" || output.answerEvidenceIds.length > 0)
  )
    throw new Error("Non-answer outcome contains answer proposal fields.");
  if (
    output.outcome === "answer" &&
    (output.answer ||
      output.references.length > 0 ||
      output.calculationReferenceIds.length > 0 ||
      output.calculationValues.length > 0 ||
      output.calculationResult !== 0 ||
      output.calculationUnit)
  )
    throw new Error("Answer outcome contains provider-authored answer fields.");
  if (output.outcome === "answer") {
    if (output.answerMode === "quote" && output.answerEvidenceIds.length !== 1)
      throw new Error("Quote answers require one evidence ID.");
    if (output.answerMode === "values" && output.answerEvidenceIds.length < 1)
      throw new Error("Value answers require evidence IDs.");
    if (
      output.answerMode !== "calculation" &&
      (output.calculationKind !== "none" ||
        output.calculationEvidenceIds.length > 0)
    )
      throw new Error("Non-calculation answers contain calculation fields.");
    if (
      output.answerMode === "calculation" &&
      (output.calculationKind === "none" ||
        output.calculationEvidenceIds.length < 2 ||
        output.answerEvidenceIds.length > 0)
    )
      throw new Error("Calculation answer sentinels are invalid.");
  }
  if (
    ["clarification", "unsupported_operation"].includes(output.outcome) &&
    !output.message.trim()
  )
    throw new Error("Message outcome requires a message.");
  return output;
}
