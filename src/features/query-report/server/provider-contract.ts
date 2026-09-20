import { z } from "zod";
import { CHAT_ANSWER_MAX_LENGTH } from "@/entities/chat";
import { type DatasetQuery, datasetQuerySchema } from "@/entities/dataset";

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
    message: z.string().max(CHAT_ANSWER_MAX_LENGTH),
    references: z
      .array(
        z
          .object({ id: z.string().max(160), excerpt: z.string().max(1_000) })
          .strict(),
      )
      .max(7),
    queryId: z.string().max(160),
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
    orderBy: z
      .array(
        z
          .object({
            fieldId: z.string().max(160),
            metricId: z.string().max(160),
            direction: z.enum(["asc", "desc"]),
          })
          .strict()
          .refine(
            (value) => (value.fieldId === "") !== (value.metricId === ""),
            "Order must reference one field or metric.",
          ),
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
    calculationReferenceIds: z.array(z.string().max(160)).max(2),
    calculationValues: z.array(z.number().finite()).max(2),
    calculationResult: z.number().finite(),
    calculationUnit: z.string().max(80),
  })
  .strict();
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
    input.calculationValues.length ||
    input.calculationResult !== 0 ||
    input.calculationUnit
  )
    throw new Error("Query outcome contains invalid sentinels.");
  return datasetQuerySchema.parse({
    queryId: applicationQueryId,
    filters: input.filters.map((filter) => ({
      fieldId: filter.fieldId,
      operator: filter.operator,
      value: decodeValue(filter),
    })),
    groupBy: input.groupBy ? { fieldId: input.groupBy } : undefined,
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
      output.calculationValues.length > 0 ||
      output.calculationResult !== 0 ||
      output.calculationUnit !== "")
  )
    throw new Error("Non-answer outcome contains calculation fields.");
  if (
    output.outcome === "answer" &&
    (!output.answer.trim() || output.references.length === 0)
  )
    throw new Error("Answer outcome requires answer and references.");
  if (
    ["clarification", "unsupported_operation"].includes(output.outcome) &&
    !output.message.trim()
  )
    throw new Error("Message outcome requires a message.");
  if (output.outcome === "not_in_source" && output.references.length)
    throw new Error("Missing-source outcome cannot cite source references.");
  return output;
}
