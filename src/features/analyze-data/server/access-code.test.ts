import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveInviteCode,
  inviteCodeExpiry,
  inviteFingerprint,
  isValidInviteCode,
  isValidInviteFingerprint,
} from "./access-code";

const seed = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";
const today = new Date("2026-09-19T23:59:59.999Z");
const tomorrow = new Date("2026-09-20T00:00:00.000Z");

afterEach(() => vi.unstubAllEnvs());

describe("daily invite capability", () => {
  it("derives one deterministic versioned code for the UTC date", () => {
    expect(deriveInviteCode(seed, today)).toBe(
      "DT-20260919-wbWaHvxnm_FWI8XuwSaR1A",
    );
    expect(deriveInviteCode(seed, new Date("2026-09-19T00:00:00Z"))).toBe(
      deriveInviteCode(seed, today),
    );
    expect(deriveInviteCode(seed, tomorrow)).not.toBe(
      deriveInviteCode(seed, today),
    );
    expect(inviteCodeExpiry(today).toISOString()).toBe(
      "2026-09-20T00:00:00.000Z",
    );
  });

  it("accepts only today's code and sealed fingerprint", () => {
    vi.stubEnv("ANALYSIS_INVITE_CODE_SEED", seed);
    const code = deriveInviteCode(seed, today);
    if (!code) throw new Error("Expected derived code.");
    const fingerprint = inviteFingerprint(code);
    expect(isValidInviteCode(code, today)).toBe(true);
    expect(isValidInviteFingerprint(fingerprint, today)).toBe(true);
    expect(isValidInviteCode(code, tomorrow)).toBe(false);
    expect(isValidInviteFingerprint(fingerprint, tomorrow)).toBe(false);
  });

  it("revokes a sealed capability after the seed changes", () => {
    vi.stubEnv("ANALYSIS_INVITE_CODE_SEED", seed);
    const code = deriveInviteCode(seed, today);
    if (!code) throw new Error("Expected derived code.");
    const fingerprint = inviteFingerprint(code);
    vi.stubEnv(
      "ANALYSIS_INVITE_CODE_SEED",
      Buffer.alloc(32, 8).toString("base64url"),
    );
    expect(isValidInviteFingerprint(fingerprint, today)).toBe(false);
  });

  it("fails closed for missing, weak, padded, or malformed seeds and fingerprints", () => {
    for (const invalid of [
      undefined,
      Buffer.alloc(31, 1).toString("base64url"),
      `${seed}=`,
      "not base64url!",
    ])
      expect(deriveInviteCode(invalid, today)).toBeUndefined();
    vi.stubEnv("ANALYSIS_INVITE_CODE_SEED", seed);
    expect(isValidInviteFingerprint("not-a-fingerprint", today)).toBe(false);
  });
});
