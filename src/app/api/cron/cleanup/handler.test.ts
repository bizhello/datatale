import { describe, expect, it, vi } from "vitest";
import { createCleanupHandler } from "./handler";

function request(authorization?: string) {
  return new Request("https://example.test/api/cron/cleanup", {
    ...(authorization ? { headers: { authorization } } : {}),
  });
}

describe("cleanup cron handler", () => {
  it("runs with database and cron configuration even when AI is unavailable", async () => {
    const cleanup = vi.fn(async () => 7);
    const handler = createCleanupHandler({
      runtimeSafe: () => true,
      secret: () => "cron-secret",
      cleanup,
    });
    const response = await handler(request("Bearer cron-secret"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ deleted: 7 });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("rejects invalid authentication and unavailable database without cleanup", async () => {
    const cleanup = vi.fn(async () => 0);
    const dependencies = {
      runtimeSafe: () => false,
      secret: () => "cron-secret",
      cleanup,
    };
    expect(
      (await createCleanupHandler(dependencies)(request("Bearer wrong")))
        .status,
    ).toBe(401);
    expect(
      (await createCleanupHandler(dependencies)(request("Bearer cron-secret")))
        .status,
    ).toBe(503);
    expect(cleanup).not.toHaveBeenCalled();
  });
});
