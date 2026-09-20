import { describe, expect, it } from "vitest";
import { validateAnswerReferences } from "./answer-validation";

const evidence = new Map([
  [
    "april",
    {
      id: "april",
      excerpt: "Группа 2026-04-01; значение 478000.",
      numericValues: [478_000],
      isoDates: ["2026-04-01"],
    },
  ],
]);

describe("localized date evidence", () => {
  it("accepts a localized month and year backed by a cited ISO date", () => {
    expect(
      validateAnswerReferences(
        "Максимальная выручка была в апреле 2026 года — 478 000.",
        [{ id: "april" }],
        evidence,
      ),
    ).toEqual([
      { id: "april", excerpt: "Группа 2026-04-01; значение 478000." },
    ]);
  });

  it("rejects a localized month absent from the cited date", () => {
    expect(() =>
      validateAnswerReferences(
        "Максимальная выручка была в мае 2026 года — 478 000.",
        [{ id: "april" }],
        evidence,
      ),
    ).toThrow(/date absent/i);
  });
});
