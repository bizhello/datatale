import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_REFUSAL } from "@/entities/chat";
import { createAskDataSend } from "./send-question";
import { AskDataClientError } from "./types";

const analysisId = "00000000-0000-4000-8000-000000000002";
const turn = {
  messageId: "00000000-0000-4000-8000-000000000003",
  question: "Какая выручка?",
};

afterEach(() => vi.unstubAllGlobals());

describe("query report API adapter", () => {
  it("sends the owned analysis reference and maps grounded evidence", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          outcome: "answered",
          answer: "Выручка: 200 RUB.",
          references: [{ id: "evidence-0", excerpt: "Revenue: 200 RUB" }],
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).resolves.toEqual({
      status: "answered",
      answer: "Выручка: 200 RUB.",
      evidenceLabels: ["Источник 1"],
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      analysisId,
      ...turn,
    });
  });

  it("maps the exact refusal and rejects invalid successful payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ outcome: "not_in_source", message: CHAT_REFUSAL }),
      ),
    );
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).resolves.toEqual({
      status: "not_in_source",
      message: CHAT_REFUSAL,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          outcome: "clarification",
          message: "Уточните, какой регион вас интересует.",
        }),
      ),
    );
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).resolves.toEqual({
      status: "clarification",
      message: "Уточните, какой регион вас интересует.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ answer: "raw" })),
    );
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("does not offer an immediate retry for quota and timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "quota" }, { status: 429 })),
    );
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).rejects.toEqual(expect.any(AskDataClientError));
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).rejects.toMatchObject({ retryable: false });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "timeout" }, { status: 504 })),
    );
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("preserves the server quota tier for access decisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { code: "quota", scope: "unlocked-workspace" },
          { status: 429 },
        ),
      ),
    );

    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).rejects.toMatchObject({
      code: "quota",
      quotaScope: "unlocked-workspace",
      retryable: false,
    });
  });

  it("preserves actionable chat error codes", async () => {
    for (const [code, status] of [
      ["expired", 401],
      ["not-found", 404],
      ["quota", 429],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ code }, { status })),
      );
      await expect(
        createAskDataSend(analysisId)(turn, new AbortController().signal),
      ).rejects.toMatchObject({ code, retryable: false });
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "in-flight" }, { status: 409 })),
    );
    await expect(
      createAskDataSend(analysisId)(turn, new AbortController().signal),
    ).rejects.toMatchObject({ code: "in-flight", retryable: true });
  });

  it("keeps provider and availability failures retryable", async () => {
    for (const [code, status] of [
      ["provider", 502],
      ["unavailable", 503],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ code }, { status })),
      );
      await expect(
        createAskDataSend(analysisId)(turn, new AbortController().signal),
      ).rejects.toMatchObject({ code, retryable: true });
    }
  });
});
