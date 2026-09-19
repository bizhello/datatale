import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bootstrapGuestWorkspace } from "./bootstrap";

const existing = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-10-19T00:00:00.000Z",
};

describe("guest workspace bootstrap", () => {
  it("reuses an active database-backed session", async () => {
    const create = vi.fn(async () => true);
    await expect(
      bootstrapGuestWorkspace({
        repository: { isActive: async () => true, create },
        readSession: async () => existing,
        saveSession: vi.fn(async () => true),
      }),
    ).resolves.toEqual(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it("inserts the workspace before saving its cookie", async () => {
    const events: string[] = [];
    const result = await bootstrapGuestWorkspace({
      repository: {
        isActive: async () => false,
        create: async () => {
          events.push("database");
          return true;
        },
      },
      readSession: async () => undefined,
      saveSession: async () => {
        events.push("cookie");
        return true;
      },
      now: () => new Date("2026-09-19T00:00:00.000Z"),
      createId: () => "00000000-0000-4000-8000-000000000002",
    });
    expect(events).toEqual(["database", "cookie"]);
    expect(result?.expiresAt).toBe("2026-10-19T00:00:00.000Z");
  });

  it("never saves a cookie when the database insert fails", async () => {
    const saveSession = vi.fn(async () => true);
    await expect(
      bootstrapGuestWorkspace({
        repository: { isActive: async () => false, create: async () => false },
        readSession: async () => undefined,
        saveSession,
      }),
    ).resolves.toBeUndefined();
    expect(saveSession).not.toHaveBeenCalled();
  });
});
