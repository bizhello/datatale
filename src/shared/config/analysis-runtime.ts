function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
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
      positiveInteger(process.env.ANALYSIS_WORKSPACE_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_IP_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_GLOBAL_DAILY_LIMIT),
  );
}

export function hasSafeAccessRuntime() {
  const configured = process.env.ANALYSIS_INVITE_CODE_HASHES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Boolean(
    hasSafeGuestRuntime() &&
      nonblank(process.env.RATE_LIMIT_SALT) &&
      configured?.length &&
      configured.every((value) => /^[a-f0-9]{64}$/i.test(value)) &&
      positiveInteger(process.env.ANALYSIS_CODE_DAILY_LIMIT),
  );
}
