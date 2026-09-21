import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CHAT_REFUSAL, type ChatResult } from "@/entities/chat";
import { ChatProviderError } from "@/features/query-report/server";
import { createChatHandler } from "./handler";

const workspace = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-09-26T00:00:00.000Z",
};
const body = {
  analysisId: "00000000-0000-4000-8000-000000000002",
  messageId: "00000000-0000-4000-8000-000000000003",
  question: "Какая выручка?",
};
const answer: ChatResult = {
  outcome: "answered",
  answer: "Выручка: 200 RUB.",
  references: [{ id: "evidence-0" }],
};

function request(value: unknown = body) {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(value),
  });
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    runtimeSafe: () => true,
    readWorkspace: async () => workspace,
    isWorkspaceActive: async () => true,
    readReply: vi.fn(async () => undefined),
    claimQuestion: vi.fn(async () => "claimed" as const),
    claimInference: vi.fn(async () => ({
      token: "00000000-0000-4000-8000-000000000004",
      expiresAt: new Date("2026-09-19T12:01:00.000Z"),
    })),
    releaseInference: vi.fn(async () => undefined),
    answer: vi.fn(async () => answer),
    saveReply: vi.fn(async () => true),
    ...overrides,
  };
}

describe("POST /api/chat handler", () => {
  it("requires same-origin, an active owner session, and a strict request", async () => {
    const base = dependencies();
    const missingOrigin = request();
    missingOrigin.headers.delete("origin");
    expect((await createChatHandler(base)(missingOrigin)).status).toBe(403);
    expect(
      (
        await createChatHandler({
          ...base,
          readWorkspace: async () => undefined,
        })(request())
      ).status,
    ).toBe(401);
    expect(
      (
        await createChatHandler(base)(
          request({ ...body, extra: "not allowed" }),
        )
      ).status,
    ).toBe(400);
  });

  it("replays a stored result without quota or provider work", async () => {
    const claimQuestion = vi.fn();
    const answerCall = vi.fn();
    const response = await createChatHandler(
      dependencies({
        readReply: async () => answer,
        claimQuestion,
        answer: answerCall,
      }),
    )(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(answer);
    expect(claimQuestion).not.toHaveBeenCalled();
    expect(answerCall).not.toHaveBeenCalled();
  });

  it("claims, answers and saves one grounded turn", async () => {
    const saveReply = vi.fn(async () => true);
    const result: ChatResult = {
      outcome: "not_in_source",
      message: CHAT_REFUSAL,
    };
    const response = await createChatHandler(
      dependencies({ answer: async () => result, saveReply }),
    )(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(saveReply).toHaveBeenCalledWith({
      workspaceId: workspace.id,
      request: body,
      result,
    });
  });

  it("keeps missing ownership and quota failures out of the provider", async () => {
    const answerCall = vi.fn(async () => answer);
    const missing = await createChatHandler(
      dependencies({
        claimQuestion: async () => "missing",
        answer: answerCall,
      }),
    )(request());
    expect(missing.status).toBe(404);
    const quota = await createChatHandler(
      dependencies({
        claimQuestion: async () => ({ kind: "quota", scope: "workspace" }),
        answer: answerCall,
      }),
    )(request());
    expect(quota.status).toBe(429);
    await expect(quota.json()).resolves.toEqual({
      code: "quota",
      scope: "workspace",
    });
    expect(answerCall).not.toHaveBeenCalled();
  });

  it("marks an exhausted elevated allowance as unlocked workspace quota", async () => {
    const answerCall = vi.fn(async () => answer);
    const response = await createChatHandler(
      dependencies({
        claimQuestion: async () => ({
          kind: "quota",
          scope: "unlocked-workspace",
        }),
        answer: answerCall,
      }),
    )(request());
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      code: "quota",
      scope: "unlocked-workspace",
    });
    expect(answerCall).not.toHaveBeenCalled();
  });

  it("does not invoke the provider twice for concurrent identical requests", async () => {
    let resolveAnswer: (() => void) | undefined;
    const answerCall = vi.fn(
      () =>
        new Promise<ChatResult>((resolve) => {
          resolveAnswer = () => resolve(answer);
        }),
    );
    let inferenceClaimed = false;
    const deps = dependencies({
      answer: answerCall,
      claimInference: vi.fn(async () => {
        if (inferenceClaimed) return "in-flight" as const;
        inferenceClaimed = true;
        return {
          token: "00000000-0000-4000-8000-000000000004",
          expiresAt: new Date("2026-09-19T12:01:00.000Z"),
        };
      }),
    });
    const first = createChatHandler(deps)(request());
    await vi.waitFor(() => expect(answerCall).toHaveBeenCalledOnce());
    const second = await createChatHandler(deps)(request());
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toEqual({ code: "in-flight" });
    resolveAnswer?.();
    expect((await first).status).toBe(200);
    expect(answerCall).toHaveBeenCalledOnce();
  });

  it.each([
    ["provider_timeout", 504, "timeout"],
    ["invalid_provider_output", 502, "invalid-answer"],
    ["provider_failure", 502, "provider"],
  ] as const)(
    "maps %s without saving an answer",
    async (code, status, responseCode) => {
      const saveReply = vi.fn();
      const response = await createChatHandler(
        dependencies({
          answer: async () => {
            throw new ChatProviderError(code, code);
          },
          saveReply,
        }),
      )(request());
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ code: responseCode });
      expect(saveReply).not.toHaveBeenCalled();
    },
  );

  it("logs only a structural stage for invalid provider output", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await createChatHandler(
        dependencies({
          answer: async () =>
            Promise.reject(
              new ChatProviderError(
                "invalid_provider_output",
                "secret raw provider output with the user question",
                "query_answer",
              ),
            ),
        }),
      )(request({ ...body, question: "secret question and source value" }));

      expect(response.status).toBe(502);
      expect(log).toHaveBeenCalledWith(
        "DataTale chat provider output rejected",
        { code: "invalid_provider_output", stage: "query_answer" },
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
      log.mockClear();

      await createChatHandler(
        dependencies({
          answer: async () =>
            Promise.reject(
              new ChatProviderError(
                "provider_failure",
                "secret transport details",
              ),
            ),
        }),
      )(request());
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
