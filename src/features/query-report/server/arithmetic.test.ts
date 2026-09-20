import { describe, expect, it } from "vitest";
import { validateArithmetic } from "./arithmetic";

describe("validateArithmetic", () => {
  const evidence = new Map([
    ["a", { numericEvidence: [{ value: 3, unit: "шт." }] }],
    ["b", { numericEvidence: [{ value: 2, unit: "шт." }] }],
  ]);

  it("recomputes a signed sum from cited typed operands", () => {
    expect(
      validateArithmetic(
        {
          kind: "sum",
          referenceIds: ["a", "b"],
          values: [3, 2],
          result: 5,
          unit: "шт.",
        },
        new Set(["a", "b"]),
        evidence,
      ),
    ).toBe(5);
  });

  it.each([["sum", [3, 2], 6, "result does not match"]] as const)(
    "rejects invalid %s arithmetic",
    (kind, values, result, message) => {
      expect(() =>
        validateArithmetic(
          {
            kind,
            referenceIds: ["a", "b"],
            values: [...values],
            result,
            unit: "",
          },
          new Set(["a", "b"]),
          evidence,
        ),
      ).toThrow(message);
    },
  );

  it("rejects division by zero", () => {
    expect(() =>
      validateArithmetic(
        {
          kind: "ratio",
          referenceIds: ["a", "b"],
          values: [3, 0],
          result: 0,
          unit: "",
        },
        new Set(["a", "b"]),
        new Map([
          ["a", { numericEvidence: [{ value: 3 }] }],
          ["b", { numericEvidence: [{ value: 0 }] }],
        ]),
      ),
    ).toThrow("ratio cannot divide by zero");
  });

  it("computes a percentage of a cited total", () => {
    expect(
      validateArithmetic(
        {
          kind: "percentage_of",
          referenceIds: ["a", "b"],
          values: [2, 5],
          result: 40,
          unit: "",
        },
        new Set(["a", "b"]),
        new Map([
          ["a", { numericEvidence: [{ value: 2, unit: "шт." }] }],
          ["b", { numericEvidence: [{ value: 5, unit: "шт." }] }],
        ]),
      ),
    ).toBe(40);
  });

  it("computes a ratio and percentage change exactly", () => {
    expect(
      validateArithmetic(
        {
          kind: "ratio",
          referenceIds: ["a", "b"],
          values: [3, 2],
          result: 1.5,
          unit: "",
        },
        new Set(["a", "b"]),
        evidence,
      ),
    ).toBe(1.5);
    expect(
      validateArithmetic(
        {
          kind: "percentage_change",
          referenceIds: ["a", "b"],
          values: [2, 3],
          result: 50,
          unit: "",
        },
        new Set(["a", "b"]),
        new Map([
          ["a", { numericEvidence: [{ value: 2, unit: "шт." }] }],
          ["b", { numericEvidence: [{ value: 3, unit: "шт." }] }],
        ]),
      ),
    ).toBe(50);
  });

  it("rejects incompatible units", () => {
    expect(() =>
      validateArithmetic(
        {
          kind: "difference",
          referenceIds: ["a", "b"],
          values: [3, 2],
          result: 1,
          unit: "шт.",
        },
        new Set(["a", "b"]),
        new Map([
          ["a", { numericEvidence: [{ value: 3, unit: "шт." }] }],
          ["b", { numericEvidence: [{ value: 2, unit: "руб." }] }],
        ]),
      ),
    ).toThrow("incompatible units");
  });
});
