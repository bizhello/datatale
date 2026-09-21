export type ArithmeticKind =
  | "none"
  | "sum"
  | "difference"
  | "ratio"
  | "percentage_of"
  | "percentage_change";

export type NumericEvidence = {
  value: number;
  unit?: string;
};

export type ArithmeticInput = {
  kind: ArithmeticKind;
  referenceIds: string[];
  values: number[];
  result: number;
  unit: string;
};

type ArithmeticReference = {
  numericEvidence?: NumericEvidence[];
};

const EPSILON = 1e-9;
export const MAX_ARITHMETIC_OPERANDS = 8;

export class ArithmeticValidationError extends Error {}

function closeEnough(actual: number, expected: number) {
  return (
    Math.abs(actual - expected) <= EPSILON * Math.max(1, Math.abs(expected))
  );
}

function fail(message: string): never {
  throw new ArithmeticValidationError(
    `Invalid arithmetic grounding: ${message}`,
  );
}

export function validateArithmetic(
  input: ArithmeticInput,
  citedReferenceIds: Set<string>,
  evidence: Map<string, ArithmeticReference>,
): number | undefined {
  if (input.kind === "none") {
    if (
      input.referenceIds.length !== 0 ||
      input.values.length !== 0 ||
      input.result !== 0 ||
      input.unit !== ""
    )
      fail("empty calculation must use empty operands and zero result.");
    return undefined;
  }
  const operandCount = input.values.length;
  if (operandCount < 2 || operandCount > MAX_ARITHMETIC_OPERANDS)
    fail(`calculation requires 2-${MAX_ARITHMETIC_OPERANDS} operands.`);
  if (input.referenceIds.length !== operandCount)
    fail("every operand requires a reference.");
  if (input.kind !== "sum" && operandCount !== 2)
    fail("only sums may contain more than two operands.");
  for (let index = 0; index < operandCount; index += 1) {
    const referenceId = input.referenceIds[index] as string;
    if (!citedReferenceIds.has(referenceId))
      fail("every operand must be cited in the answer references.");
    const reference = evidence.get(referenceId);
    if (!reference) fail("every operand must use a trusted reference.");
    if (
      !reference.numericEvidence?.some((item) =>
        closeEnough(item.value, input.values[index] as number),
      )
    )
      fail("operand value is absent from its trusted reference.");
  }
  const first = input.values[0] as number;
  const second = input.values[1] as number;
  const firstUnit = evidence
    .get(input.referenceIds[0] as string)
    ?.numericEvidence?.find((item) => closeEnough(item.value, first))?.unit;
  const secondUnit = evidence
    .get(input.referenceIds[1] as string)
    ?.numericEvidence?.find((item) => closeEnough(item.value, second))?.unit;
  if (firstUnit && secondUnit && firstUnit !== secondUnit)
    fail("operands have incompatible units.");
  const units = input.referenceIds.map(
    (referenceId, index) =>
      evidence
        .get(referenceId)
        ?.numericEvidence?.find((item) =>
          closeEnough(item.value, input.values[index] as number),
        )?.unit,
  );
  const knownUnits = units.filter((unit): unit is string => Boolean(unit));
  if (knownUnits.some((unit) => unit !== knownUnits[0]))
    fail("operands have incompatible units.");
  if (input.unit && firstUnit && input.unit !== firstUnit)
    fail("result unit does not match the operand unit.");
  if (input.unit && secondUnit && input.unit !== secondUnit)
    fail("result unit does not match the operand unit.");
  if (input.unit && knownUnits.some((unit) => input.unit !== unit))
    fail("result unit does not match the operand unit.");
  if (input.kind === "ratio" && second === 0)
    fail("ratio cannot divide by zero.");
  if (
    (input.kind === "percentage_change" || input.kind === "percentage_of") &&
    (input.kind === "percentage_change" ? first : second) === 0
  )
    fail("percentage change cannot use a zero baseline.");
  const expected =
    input.kind === "sum"
      ? input.values.reduce((sum, value) => sum + value, 0)
      : input.kind === "difference"
        ? first - second
        : input.kind === "ratio"
          ? first / second
          : input.kind === "percentage_of"
            ? (first / second) * 100
            : ((second - first) / first) * 100;
  if (!Number.isFinite(expected) || !closeEnough(input.result, expected))
    fail("result does not match the trusted operands.");
  return expected;
}
