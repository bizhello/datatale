import { describe, expect, it, vi } from "vitest";
import { createGuestHandlers } from "./handler";

const workspace = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-10-19T00:00:00.000Z",
};

function dependencies() {
  return {
    runtimeSafe: () => true,
    bootstrap: vi.fn(async () => workspace),
    readSession: vi.fn(async () => workspace),
    clearSession: vi.fn(async () => undefined),
    repository: {
      isActive: vi.fn(async () => true),
      create: vi.fn(async () => true),
      refresh: vi.fn(async () => true),
    },
    deleteWorkspace: vi.fn(async () => true),
  };
}

describe("guest route handlers", () => {
  it("requires same-origin POST and returns only public expiry metadata", async () => {
    const deps = dependencies();
    const handlers = createGuestHandlers(deps);
    const missingOrigin = new Request("https://example.test/api/guest", {
      method: "POST",
    });
    expect((await handlers.post(missingOrigin)).status).toBe(403);
    expect(deps.bootstrap).not.toHaveBeenCalled();

    const response = await handlers.post(
      new Request("https://example.test/api/guest", {
        method: "POST",
        headers: { origin: "https://example.test" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      expiresAt: workspace.expiresAt,
    });
  });
});
