import { NoObjectGeneratedError } from "ai";
import { describe, expect, it, vi } from "vitest";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});

import { defaultProvider } from "./service";

function structuredOutputError() {
  return new NoObjectGeneratedError({
    message: "The provider returned incomplete structured output.",
    response: {} as never,
    usage: {} as never,
    finishReason: "stop",
  });
}

describe("default chat provider", () => {
  const nativeURL = URL;

  function stubPromptURL() {
    vi.stubGlobal(
      "URL",
      class TestURL extends nativeURL {
        constructor(input: string | URL, base?: string | URL) {
          super(
            typeof input === "string" && input.includes("prompts/chat.md")
              ? `file://${process.cwd()}/src/features/query-report/server/prompts/chat.md`
              : input,
            base,
          );
        }
      },
    );
  }

  it("retries one structured-output decoding failure with a complete-fields instruction", async () => {
    stubPromptURL();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/v1");
    vi.stubEnv("AI_MODEL", "test-model");
    generateTextMock
      .mockRejectedValueOnce(structuredOutputError())
      .mockResolvedValueOnce({ output: { outcome: "query" } });

    await expect(
      defaultProvider({
        prompt: '{"kind":"profile"}',
        signal: new AbortController().signal,
        output: "query",
      }),
    ).resolves.toEqual({ outcome: "query" });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock.mock.calls[1]?.[0].prompt).toContain(
      "every required field",
    );
  });

  it("does not retry a provider failure", async () => {
    stubPromptURL();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/v1");
    vi.stubEnv("AI_MODEL", "test-model");
    const error = new Error("gateway unavailable");
    generateTextMock.mockRejectedValueOnce(error);

    await expect(
      defaultProvider({
        prompt: "{}",
        signal: new AbortController().signal,
        output: "outcome",
      }),
    ).rejects.toBe(error);
    expect(generateTextMock).toHaveBeenCalledOnce();
  });
});
