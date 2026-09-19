import { describe, expect, it, vi } from "vitest";
import { createAccessHandler } from "./handler";

const request = (body: unknown, origin = "https://example.test") =>
  new Request("https://example.test/api/access", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.8",
    },
    body: JSON.stringify(body),
  });

function setup() {
  const saveCapability = vi.fn(async () => true);
  const allowInvalidAttempt = vi.fn(async () => true);
  return {
    saveCapability,
    allowInvalidAttempt,
    handler: createAccessHandler({
      runtimeSafe: () => true,
      readWorkspace: async () => ({ id: "workspace" }),
      hashIp: () => "salted-ip",
      allowInvalidAttempt,
      saveCapability,
      fingerprint: (code) => `fingerprint:${code}`,
      validCode: (code) => code === "valid-invite",
    }),
  };
}

describe("POST /api/access", () => {
  it("requires same origin and stores only a derived capability", async () => {
    const setup_ = setup();
    expect(
      (
        await setup_.handler(
          request({ code: "valid-invite" }, "https://evil.test"),
        )
      ).status,
    ).toBe(403);
    expect(
      (await setup_.handler(request({ code: "valid-invite" }))).status,
    ).toBe(200);
    expect(setup_.saveCapability).toHaveBeenCalledWith(
      "fingerprint:valid-invite",
    );
    expect(setup_.saveCapability).not.toHaveBeenCalledWith("valid-invite");
  });

  it("returns stable generic invalid and rate-limit errors", async () => {
    const setup_ = setup();
    await expect(
      (await setup_.handler(request({ code: "wrong" }))).json(),
    ).resolves.toEqual({ code: "invalid-code" });
    setup_.allowInvalidAttempt.mockResolvedValue(false);
    await expect(
      (await setup_.handler(request({ code: "wrong" }))).json(),
    ).resolves.toEqual({ code: "rate-limited" });
  });
});
