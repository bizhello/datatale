import { isValidInviteFingerprint } from "@/features/analyze-data/server";
import { workspaceDailyQuota } from "@/shared/config";

export type ChatQuota = Readonly<{
  limit: number;
  scope: "workspace" | "unlocked-workspace";
  now: Date;
}>;

export function resolveChatQuota(
  fingerprint: string | undefined,
  date = new Date(),
  limits = workspaceDailyQuota,
): ChatQuota {
  const unlocked = Boolean(
    fingerprint && isValidInviteFingerprint(fingerprint, date),
  );
  return unlocked
    ? { limit: limits.unlocked, scope: "unlocked-workspace", now: date }
    : { limit: limits.free, scope: "workspace", now: date };
}
