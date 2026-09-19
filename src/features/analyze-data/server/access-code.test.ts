import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inviteFingerprint,
  isValidInviteCode,
  isValidInviteFingerprint,
} from "./access-code";

afterEach(() => vi.unstubAllEnvs());

describe("invite capability validation", () => {
  it("revokes a sealed fingerprint when its hash is removed from configuration", () => {
    const fingerprint = inviteFingerprint("high-entropy-code");
    vi.stubEnv("ANALYSIS_INVITE_CODE_HASHES", fingerprint);
    expect(isValidInviteCode("high-entropy-code")).toBe(true);
    expect(isValidInviteFingerprint(fingerprint)).toBe(true);
    vi.stubEnv("ANALYSIS_INVITE_CODE_HASHES", "");
    expect(isValidInviteFingerprint(fingerprint)).toBe(false);
  });

  it("rejects malformed fingerprints before comparison", () => {
    vi.stubEnv("ANALYSIS_INVITE_CODE_HASHES", "a".repeat(64));
    expect(isValidInviteFingerprint("not-a-fingerprint")).toBe(false);
  });
});
