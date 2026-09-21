import { z } from "zod";
import { CHAT_PROVIDER_MESSAGE_MAX_LENGTH } from "@/entities/chat";
import { type DatasetQuery, datasetQuerySchema } from "@/entities/dataset";
import { MAX_ARITHMETIC_OPERANDS } from "./arithmetic";

/** Flat strict gateway contract: the application resolves all facts from IDs. */
const queryWireSchema = z
  .object({
    purpose: z.enum(["lookup", "count"]),
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
    groupByDateBucket: z.enum(["", "day", "month", "quarter", "year"]),
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
          .strict(),
      )
      .max(20),
    limit: z.number().int().min(1).max(100),
  })
  .strict();

const answerPartSchema = z
  .object({
    kind: z.enum(["quote", "values", "calculation", "not_in_source"]),
    evidenceIds: z
      .array(z.string().max(160))
      .min(1)
      .max(MAX_ARITHMETIC_OPERANDS),
    operation: z.enum([
      "none",
      "sum",
      "difference",
      "ratio",
      "percentage_of",
      "percentage_change",
    ]),
  })
  .strict();

export const providerEnvelopeSchema = z
  .object({
    outcome: z.enum([
      "answer",
      "clarification",
      "not_in_source",
      "unsupported_operation",
      "query",
    ]),
    message: z.string().max(CHAT_PROVIDER_MESSAGE_MAX_LENGTH),
    answerParts: z.array(answerPartSchema).max(8),
    queries: z.array(queryWireSchema).max(4),
  })
  .strict();
export const providerQueryEnvelopeSchema = providerEnvelopeSchema;
export type ProviderEnvelope = z.output<typeof providerEnvelopeSchema>;
export type ProviderAnswerPart = ProviderEnvelope["answerParts"][number];
export type ProviderQuery = ProviderEnvelope["queries"][number];

function decodeValue(
  filter: ProviderQuery["filters"][number],
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
  input: ProviderQuery,
  applicationQueryId: string,
): DatasetQuery {
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
  const parsed = providerEnvelopeSchema.parse(raw);
  const output =
    parsed.outcome === "answer"
      ? { ...parsed, message: "", queries: [] }
      : parsed.outcome === "query"
        ? { ...parsed, message: "", answerParts: [] }
        : { ...parsed, answerParts: [], queries: [] };
  if (output.outcome === "query") {
    if (
      output.answerParts.length ||
      output.message ||
      output.queries.length < 1 ||
      output.queries.length > 4
    )
      throw new Error("Query outcome sentinels are invalid.");
  } else if (output.outcome === "answer") {
    if (
      output.message ||
      output.queries.length ||
      output.answerParts.length < 1 ||
      output.answerParts.length > 8
    )
      throw new Error("Answer outcome sentinels are invalid.");
    for (const part of output.answerParts) {
      if (part.kind !== "calculation" && part.operation !== "none")
        throw new Error("Non-calculation answer has an operation.");
      if (
        part.kind === "quote" &&
        (part.operation !== "none" || part.evidenceIds.length !== 1)
      )
        throw new Error("Quote answer requires one ID and no operation.");
      if (
        part.kind === "not_in_source" &&
        (part.operation !== "none" || part.evidenceIds.length !== 1)
      )
        throw new Error(
          "Absence answer requires one witness ID and no operation.",
        );
      if (
        part.kind === "calculation" &&
        (part.operation === "none" ||
          part.evidenceIds.length < 2 ||
          new Set(part.evidenceIds).size !== part.evidenceIds.length)
      )
        throw new Error("Calculation answer has invalid IDs or operation.");
    }
  } else if (
    output.answerParts.length ||
    output.queries.length ||
    (output.outcome !== "not_in_source" && !output.message.trim()) ||
    (output.outcome === "not_in_source" && output.message)
  ) {
    throw new Error("Non-answer outcome contains answer or query fields.");
  }
  return output;
}
