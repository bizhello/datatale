import { datasetSchema, textSourceSchema } from "@/entities/dataset";
import {
  readGuestWorkspace,
  readInviteCodeFingerprint,
  SqlGuestWorkspaceRepository,
} from "@/entities/guest-workspace/server";
import { finalReportSchema } from "@/entities/report";
import { SqlSavedAnalysisRepository } from "@/entities/saved-analysis/server";
import {
  analyzeSource,
  getRunGate,
  hashIp,
  isValidInviteFingerprint,
} from "@/features/analyze-data/server";
import { hasSafeAnalysisRuntime } from "@/shared/config";
import { createAnalyzeHandler } from "./handler";

const workspaceRepository = new SqlGuestWorkspaceRepository();
const savedAnalysisRepository = new SqlSavedAnalysisRepository({
  source: {
    parse(input) {
      const dataset = datasetSchema.safeParse(input);
      if (dataset.success) return dataset.data;
      return textSourceSchema.parse(input);
    },
  },
  report: finalReportSchema,
});

export const POST = createAnalyzeHandler({
  runtimeSafe: hasSafeAnalysisRuntime,
  readWorkspace: readGuestWorkspace,
  readInviteCodeFingerprint,
  isWorkspaceActive: (id, now) => workspaceRepository.isActive(id, now),
  hashIp,
  validCodeFingerprint: isValidInviteFingerprint,
  gate: getRunGate,
  analyze: analyzeSource,
  saveAnalysis: async (input) =>
    Boolean(await savedAnalysisRepository.create(input)),
});
