import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

export function getAnalysisModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const modelId = process.env.AI_MODEL;
  if (!apiKey || !baseURL || !modelId) return undefined;
  return createOpenAI({ apiKey, baseURL }).chat(modelId);
}
