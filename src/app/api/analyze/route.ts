import {
  readGuestWorkspace,
  readInviteCodeFingerprint,
  SqlGuestWorkspaceRepository,
} from "@/entities/guest-workspace/server";
import {
  analyzeSource,
  getRunGate,
  hashIp,
  isValidInviteFingerprint,
} from "@/features/analyze-data/server";
import { hasSafeAnalysisRuntime } from "@/shared/config";
import { createAnalyzeHandler } from "./handler";

const workspaceRepository = new SqlGuestWorkspaceRepository();

export const POST = createAnalyzeHandler({
  runtimeSafe: hasSafeAnalysisRuntime,
  readWorkspace: readGuestWorkspace,
  readInviteCodeFingerprint,
  isWorkspaceActive: (id, now) => workspaceRepository.isActive(id, now),
  hashIp,
  validCodeFingerprint: isValidInviteFingerprint,
  gate: getRunGate,
  analyze: analyzeSource,
});
