import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  chartCapabilityCatalog,
  chartCatalogPromptDescription,
} from "@/entities/report";

describe("analysis prompt contracts", () => {
  it("keeps structured prompt policy aligned with the code-owned catalog and schemas", async () => {
    const directory = `${process.cwd()}/src/features/analyze-data/server/prompts`;
    const [table, text, narrative] = await Promise.all([
      readFile(`${directory}/table.md`, "utf8"),
      readFile(`${directory}/text.md`, "utf8"),
      readFile(`${directory}/narrative.md`, "utf8"),
    ]);
    for (const capability of chartCapabilityCatalog) {
      expect(chartCatalogPromptDescription).toContain(capability.kind);
      expect(chartCatalogPromptDescription).toContain(
        capability.allowedAggregations.join(", "),
      );
    }
    for (const prompt of [table, text, narrative]) {
      for (const section of [
        "# Role",
        "# Objective",
        "# Trust boundary",
        "# Output contract",
        "# Final checklist",
      ])
        expect(prompt).toContain(section);
      expect(prompt).toContain("untrusted data");
      expect(prompt).toContain("Return only");
    }
    expect(table).toContain("Do not treat a bounded sample");
    expect(table).toContain("trusted capability catalog");
    expect(table).toContain(
      "Select `no-chart` only when fewer than two distinct stories satisfy that catalog",
    );
    expect(table).toContain("topNCount");
    expect(table).toContain("user-visible metric label");
    expect(table).toContain("in Russian");
    expect(text).toContain("exact contiguous quotation");
    expect(text).toContain("fact label in Russian");
    expect(text).toContain(
      "Copy `subject` as the shortest exact source phrase",
    );
    expect(text).toContain("empty collection is correct");
    expect(narrative).toContain("application-checked facts and evidence");
    expect(narrative).toContain("all user-visible narrative");
    expect(narrative).toContain("An empty list is better");
  });
});
