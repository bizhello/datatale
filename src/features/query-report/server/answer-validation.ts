import { type ArithmeticInput, validateArithmetic } from "./arithmetic";
import { numericValues } from "./source-context";

type QueryResultReference = {
  id: string;
  excerpt?: string;
  numericValues?: number[];
  numericEvidence?: { value: number; unit?: string }[];
};

export function validateAnswerReferences(
  answer: string,
  references: Array<{ id: string; excerpt?: string | undefined }>,
  evidence: Map<string, QueryResultReference>,
  requiredId?: string,
  arithmetic?: ArithmeticInput,
) {
  if (references.length < 1 || references.length > 7)
    throw new Error("Answer must cite source references.");
  const seen = new Set<string>();
  const trusted = references.map((reference) => {
    if (seen.has(reference.id) || !evidence.has(reference.id))
      throw new Error("Answer cited unknown or duplicate source reference.");
    seen.add(reference.id);
    return {
      id: reference.id,
      excerpt: evidence.get(reference.id)?.excerpt as string,
    };
  });
  if (requiredId && !seen.has(requiredId))
    throw new Error("Numeric answer must cite the query result reference.");
  const evidenceNumbers = new Set(
    trusted.flatMap(
      (reference) => evidence.get(reference.id)?.numericValues ?? [],
    ),
  );
  const derivedValue = arithmetic
    ? validateArithmetic(arithmetic, seen, evidence)
    : undefined;
  for (const value of numericValues(answer))
    if (
      !evidenceNumbers.has(value) &&
      (derivedValue === undefined ||
        Math.abs(value - derivedValue) >
          1e-9 * Math.max(1, Math.abs(derivedValue)))
    )
      throw new Error("Answer contains a number absent from cited evidence.");
  return trusted;
}
