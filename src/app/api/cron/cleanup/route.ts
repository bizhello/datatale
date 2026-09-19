import { cleanupAnalysisGate } from "@/features/analyze-data/server";
import { hasSafeCleanupRuntime } from "@/shared/config";
import { createCleanupHandler } from "./handler";

export const GET = createCleanupHandler({
  runtimeSafe: hasSafeCleanupRuntime,
  secret: () => process.env.CRON_SECRET,
  cleanup: cleanupAnalysisGate,
});
