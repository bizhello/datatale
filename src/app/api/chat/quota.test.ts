import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deriveInviteCode,
  inviteFingerprint,
} from "@/features/analyze-data/server";
import { resolveChatQuota } from "./quota";

const seed = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";
const today = new Date("2026-09-19T12:00:00.000Z");

afterEach(() => vi.unstubAllEnvs());

describe("chat quota tier", () => {
  it("uses five messages without a current access capability", () => {
    expect(resolveChatQuota(undefined, today)).toEqual({
      limit: 5,
      scope: "workspace",
      now: today,
    });
  });

  it("uses twenty messages for today's sealed access capability", () => {
    vi.stubEnv("ANALYSIS_INVITE_CODE_SEED", seed);
    const code = deriveInviteCode(seed, today);
    if (!code) throw new Error("Expected derived code.");
    expect(
      resolveChatQuota(inviteFingerprint(code), today, {
        free: 5,
        unlocked: 20,
      }),
    ).toEqual({ limit: 20, scope: "unlocked-workspace", now: today });
  });

  it("falls back to five when yesterday's capability is still sealed", () => {
    vi.stubEnv("ANALYSIS_INVITE_CODE_SEED", seed);
    const yesterday = new Date("2026-09-18T12:00:00.000Z");
    const code = deriveInviteCode(seed, yesterday);
    if (!code) throw new Error("Expected derived code.");
    expect(
      resolveChatQuota(inviteFingerprint(code), today, {
        free: 5,
        unlocked: 20,
      }),
    ).toEqual({ limit: 5, scope: "workspace", now: today });
  });

  it("returns the exact validation timestamp for the atomic quota claim", () => {
    vi.stubEnv("ANALYSIS_INVITE_CODE_SEED", seed);
    const beforeMidnight = new Date("2026-09-19T23:59:59.999Z");
    const code = deriveInviteCode(seed, beforeMidnight);
    if (!code) throw new Error("Expected derived code.");
    const quota = resolveChatQuota(inviteFingerprint(code), beforeMidnight, {
      free: 5,
      unlocked: 20,
    });
    expect(quota).toEqual({
      limit: 20,
      scope: "unlocked-workspace",
      now: beforeMidnight,
    });
    expect(quota.now).toBe(beforeMidnight);
  });
});
