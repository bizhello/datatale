import { describe, expect, it } from "vitest";
import {
  createShowcaseDemoSource,
  isShowcaseDemoSource,
} from "./showcase-demo";

describe("showcase demo source", () => {
  it("creates the one canonical dataset accepted by the demo quota", () => {
    const source = createShowcaseDemoSource();

    expect(isShowcaseDemoSource(source)).toBe(true);
    expect(source.source).toEqual({ kind: "csv", filename: "demo.csv" });
    expect(source.rows).toHaveLength(4);
  });

  it("rejects lookalike filenames, changed values, and changed provenance", () => {
    const source = createShowcaseDemoSource();
    const changedFilename = structuredClone(source);
    changedFilename.source = { kind: "csv", filename: "demo-copy.csv" };
    const changedValue = structuredClone(source);
    const changedProvenance = structuredClone(source);
    const changedValueRow = changedValue.rows[0];
    const changedProvenanceRow = changedProvenance.rows[0];
    if (!changedValueRow || !changedProvenanceRow)
      throw new Error("Expected the canonical demo rows.");
    changedValueRow.values.column_2 = 999_999;
    changedProvenanceRow.provenance.sourceRowNumber = 99;

    expect(isShowcaseDemoSource(changedFilename)).toBe(false);
    expect(isShowcaseDemoSource(changedValue)).toBe(false);
    expect(isShowcaseDemoSource(changedProvenance)).toBe(false);
  });
});
