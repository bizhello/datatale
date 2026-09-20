import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  chartCapabilityCatalog,
  chartCatalogPromptDescription,
} from "@/entities/report";

describe("analysis prompt contracts", () => {
  it("keeps trusted prompt rules aligned with the code-owned catalog and schemas", async () => {
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
    expect(table).toContain("untrusted data");
    expect(table).toContain("topN");
    expect(table).toContain("user-visible label");
    expect(table).toContain("in Russian");
    expect(text).toContain("exact, contiguous quotation");
    expect(text).toContain("fact label in Russian");
    expect(narrative).toContain("checked facts and evidence");
    expect(narrative).toContain("in Russian");
  });
});
