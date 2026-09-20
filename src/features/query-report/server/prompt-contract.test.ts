import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("grounded chat prompt contract", () => {
  it("defines claim selection, refusal, and injection boundaries explicitly", async () => {
    const prompt = await readFile(
      `${process.cwd()}/src/features/query-report/server/prompts/chat.md`,
      "utf8",
    );

    for (const section of [
      "# Role",
      "# Objective",
      "# Trust boundary",
      "# Decision procedure",
      "# Claim selection rules",
      "# Output contract",
      "# Final checklist",
    ])
      expect(prompt).toContain(section);
    expect(prompt).toContain("do not write the final answer");
    expect(prompt).toContain("smallest set of canonical claim IDs");
    expect(prompt).toContain("insufficient_data");
    expect(prompt).toContain("unsupported_operation");
    expect(prompt).toContain("explicitly state a baseline and a later change");
    expect(prompt).toContain(
      "Do not calculate or claim the derived final value",
    );
    expect(prompt).toContain("В этом отчете нет такой информации");
    expect(prompt).toContain("Return only the strict structured object");
  });
});
