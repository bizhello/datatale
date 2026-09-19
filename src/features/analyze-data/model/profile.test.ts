import { describe, expect, it } from "vitest";
import type { TextSource } from "@/entities/dataset";
import { boundedSourceDescription } from "./profile";

describe("analysis source description", () => {
  it("includes the complete accepted text beyond the former 12,000-character cutoff", () => {
    const tail = "DECISIVE_COMPLETE_SOURCE_TAIL";
    const rawText = `${"x".repeat(29_000)}${tail}`;
    const source: TextSource = {
      version: 1,
      id: "long-text",
      source: { kind: "text" },
      rawText,
      paragraphs: [{ index: 1, text: rawText }],
    };
    const description = boundedSourceDescription(source);
    expect(description).toContain(tail);
    expect(description.endsWith(rawText)).toBe(true);
  });
});
