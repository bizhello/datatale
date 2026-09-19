import "server-only";
import { readFile } from "node:fs/promises";

export async function loadPrompt(kind: "table" | "text") {
  return readFile(new URL(`./prompts/${kind}.md`, import.meta.url), "utf8");
}
