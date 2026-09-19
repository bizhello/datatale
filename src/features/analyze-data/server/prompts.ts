import "server-only";
import { readFile } from "node:fs/promises";

export type PromptKind = "table" | "text" | "narrative";

export async function loadPrompt(kind: PromptKind) {
  switch (kind) {
    case "table":
      return readFile(new URL("./prompts/table.md", import.meta.url), "utf8");
    case "text":
      return readFile(new URL("./prompts/text.md", import.meta.url), "utf8");
    case "narrative":
      return readFile(
        new URL("./prompts/narrative.md", import.meta.url),
        "utf8",
      );
  }
}
