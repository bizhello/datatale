import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bootstrapGuestWorkspace } from "./bootstrap";

const existing = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-10-19T00:00:00.000Z",
};

describe("guest workspace bootstrap", () => {
  it("refreshes an active database-backed session before its cookie", async () => {
    const create = vi.fn(async () => true);
    const events: string[] = [];
    await expect(
      bootstrapGuestWorkspace({
        repository: {
          isActive: async () => true,
          create,
          refresh: async () => {
            events.push("database");
            return true;
          },
        },
        readSession: async () => existing,
        saveSession: vi.fn(async () => {
          events.push("cookie");
          return true;
        }),
        now: () => new Date("2026-09-20T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      id: existing.id,
      expiresAt: "2026-10-20T00:00:00.000Z",
    });
    expect(create).not.toHaveBeenCalled();
    expect(events).toEqual(["database", "cookie"]);
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
        refresh: async () => false,
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
        repository: {
          isActive: async () => false,
          create: async () => false,
          refresh: async () => false,
        },
        readSession: async () => undefined,
        saveSession,
      }),
    ).resolves.toBeUndefined();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("never extends the cookie when the database refresh fails", async () => {
    const saveSession = vi.fn(async () => true);
    await expect(
      bootstrapGuestWorkspace({
        repository: {
          isActive: async () => true,
          create: async () => true,
          refresh: async () => false,
        },
        readSession: async () => existing,
        saveSession,
      }),
    ).resolves.toBeUndefined();
    expect(saveSession).not.toHaveBeenCalled();
  });
});
