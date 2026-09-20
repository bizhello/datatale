function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function isValidInviteCodeSeed(
  value: string | undefined,
): value is string {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length >= 32 && decoded.toString("base64url") === value;
}

function nonblank(value: string | undefined) {
  return Boolean(value?.trim());
}

export function hasSafeGuestRuntime() {
  return Boolean(
    nonblank(process.env.DATABASE_URL) &&
      nonblank(process.env.SESSION_PASSWORD) &&
      process.env.SESSION_PASSWORD &&
      process.env.SESSION_PASSWORD.length >= 32,
  );
}

export function hasSafeCleanupRuntime() {
  return Boolean(
    nonblank(process.env.DATABASE_URL) && nonblank(process.env.CRON_SECRET),
  );
}

/** Paid calls are disabled until every spend and ownership control exists. */
export function hasSafeAnalysisRuntime() {
  return Boolean(
    hasSafeGuestRuntime() &&
      nonblank(process.env.OPENAI_API_KEY) &&
      nonblank(process.env.OPENAI_BASE_URL) &&
      nonblank(process.env.AI_MODEL) &&
      nonblank(process.env.RATE_LIMIT_SALT) &&
      positiveInteger(process.env.ANALYSIS_IP_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_GLOBAL_DAILY_LIMIT),
  );
}

export function hasSafeChatRuntime() {
  return hasSafeAnalysisRuntime();
}

export function hasSafeAccessRuntime() {
  return Boolean(
    hasSafeGuestRuntime() &&
      nonblank(process.env.RATE_LIMIT_SALT) &&
      isValidInviteCodeSeed(process.env.ANALYSIS_INVITE_CODE_SEED),
  );
}
