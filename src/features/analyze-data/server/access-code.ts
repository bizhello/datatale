import { createHash, timingSafeEqual } from "node:crypto";

export function inviteCodeHashes() {
  return (process.env.ANALYSIS_INVITE_CODE_HASHES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-f0-9]{64}$/.test(value));
}

export function inviteFingerprint(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function isValidInviteCode(code: string) {
  const candidate = Buffer.from(inviteFingerprint(code), "hex");
  let matched = false;
  for (const configured of inviteCodeHashes()) {
    const expected = Buffer.from(configured, "hex");
    const equal =
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate);
    matched ||= equal;
  }
  return matched;
}
