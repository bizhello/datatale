import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveInviteCode,
  inviteCodeExpiry,
} from "../src/features/analyze-data/server/access-code";

export function accessCodeOutput(
  seed = process.env.ANALYSIS_INVITE_CODE_SEED,
  date = new Date(),
) {
  const code = deriveInviteCode(seed, date);
  if (!code)
    throw new Error(
      "ANALYSIS_INVITE_CODE_SEED must be unpadded base64url for at least 32 bytes.",
    );
  return `${code}\nExpires: ${inviteCodeExpiry(date).toISOString()} (UTC)`;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(accessCodeOutput());
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Cannot derive code.",
    );
    process.exitCode = 1;
  }
}
