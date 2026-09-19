function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Production calls are disabled until every spend and retention control exists. */
export function hasSafeAnalysisRuntime() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.INSPIRO_GATEWAY_API_KEY &&
      process.env.AI_GATEWAY_URL &&
      process.env.AI_MODEL &&
      process.env.SESSION_PASSWORD &&
      process.env.RATE_LIMIT_SALT &&
      process.env.CRON_SECRET &&
      positiveInteger(process.env.ANALYSIS_WORKSPACE_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_IP_DAILY_LIMIT) &&
      positiveInteger(process.env.ANALYSIS_GLOBAL_DAILY_LIMIT),
  );
}
