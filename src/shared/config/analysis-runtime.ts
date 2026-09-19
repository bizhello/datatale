function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonblank(value: string | undefined) {
  return Boolean(value?.trim());
}

/** Production calls are disabled until every spend and retention control exists. */
export function hasSafeAnalysisRuntime() {
  return Boolean(
    nonblank(process.env.DATABASE_URL) &&
      nonblank(process.env.OPENAI_API_KEY) &&
      nonblank(process.env.OPENAI_BASE_URL) &&
      nonblank(process.env.AI_MODEL) &&
      process.env.SESSION_PASSWORD &&
      process.env.SESSION_PASSWORD.length >= 32 &&
      nonblank(process.env.RATE_LIMIT_SALT) &&
      nonblank(process.env.CRON_SECRET) &&
      positiveInteger(process.env.ANALYSIS_WORKSPACE_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_IP_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_GLOBAL_DAILY_LIMIT),
  );
}
