import { afterEach, describe, expect, it, vi } from "vitest";

const { chat, createOpenAI } = vi.hoisted(() => {
  const chat = vi.fn((modelId: string) => ({ modelId }));
  return { chat, createOpenAI: vi.fn(() => ({ chat })) };
});

vi.mock("server-only", () => ({}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI }));

import { getAnalysisModel } from "./server";

describe("AI model routing", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses a stage override without replacing the configured primary model", () => {
    vi.stubEnv("OPENAI_API_KEY", "key");
    vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/v1");
    vi.stubEnv("AI_MODEL", "primary-model");

    expect(getAnalysisModel()).toEqual({ modelId: "primary-model" });
    expect(getAnalysisModel("text-model")).toEqual({ modelId: "text-model" });
    expect(chat).toHaveBeenNthCalledWith(1, "primary-model");
    expect(chat).toHaveBeenNthCalledWith(2, "text-model");
  });
});
