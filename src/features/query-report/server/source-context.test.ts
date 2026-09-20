import { describe, expect, it } from "vitest";
import type { TextSource } from "@/entities/dataset";
import { textEvidence } from "./source-context";

describe("textEvidence", () => {
  it("keeps a numeric token intact when a long word crosses a chunk boundary", () => {
    const source: TextSource = {
      version: 1,
      id: "long-text",
      source: { kind: "text" },
      rawText: `${"x".repeat(995)}1234567890 кошек`,
      paragraphs: [{ index: 1, text: `${"x".repeat(995)}1234567890 кошек` }],
    };

    const chunks = textEvidence(source);

    expect(chunks.every((chunk) => chunk.text.length <= 1_000)).toBe(true);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]?.text).toContain("1234567890 кошек");
  });
});
