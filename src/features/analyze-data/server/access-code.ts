import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isValidInviteCodeSeed } from "@/shared/config";

const CODE_CONTEXT = "datatale-access:v1";

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function inviteCodeExpiry(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
}

export function deriveInviteCode(
  seed = process.env.ANALYSIS_INVITE_CODE_SEED,
  date = new Date(),
) {
  if (!isValidInviteCodeSeed(seed)) return undefined;
  const day = utcDate(date);
  const digest = createHmac("sha256", Buffer.from(seed, "base64url"))
    .update(`${CODE_CONTEXT}:${day}`)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
  return `DT-${day.replaceAll("-", "")}-${digest}`;
}

export function inviteFingerprint(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function isValidInviteCode(code: string, date = new Date()) {
  const expected = deriveInviteCode(undefined, date);
  if (!expected) return false;
  const candidate = Buffer.from(code);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidate.length === expectedBuffer.length &&
    timingSafeEqual(candidate, expectedBuffer)
  );
}

export function isValidInviteFingerprint(
  fingerprint: string,
  date = new Date(),
) {
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) return false;
  const code = deriveInviteCode(undefined, date);
  if (!code) return false;
  const candidate = Buffer.from(fingerprint, "hex");
  const expected = Buffer.from(inviteFingerprint(code), "hex");
  return timingSafeEqual(expected, candidate);
}
