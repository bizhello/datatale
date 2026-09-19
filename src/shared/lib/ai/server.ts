import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

export function getAnalysisModel() {
  const apiKey = process.env.INSPIRO_GATEWAY_API_KEY;
  const baseURL = process.env.AI_GATEWAY_URL;
  const modelId = process.env.AI_MODEL;
  if (!apiKey || !baseURL || !modelId) return undefined;
  return createOpenAI({ apiKey, baseURL }).chat(modelId);
}
