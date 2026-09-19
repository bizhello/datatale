import { cleanupAnalysisGate } from "@/features/analyze-data/server";
import { hasSafeCleanupRuntime } from "@/shared/config";
import { savedAnalysisRepository } from "../../saved-analysis-runtime";
import { cleanupExpiredData } from "./cleanup";
import { createCleanupHandler } from "./handler";

export const GET = createCleanupHandler({
  runtimeSafe: hasSafeCleanupRuntime,
  secret: () => process.env.CRON_SECRET,
  cleanup: () =>
    cleanupExpiredData(cleanupAnalysisGate, () =>
      savedAnalysisRepository.cleanup(),
    ),
});
