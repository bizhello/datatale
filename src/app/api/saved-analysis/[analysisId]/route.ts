import {
  readGuestWorkspace,
  SqlGuestWorkspaceRepository,
} from "@/entities/guest-workspace/server";
import { hasSafeGuestRuntime } from "@/shared/config";
import { savedAnalysisRepository } from "../../saved-analysis-runtime";
import { createSavedAnalysisHandlers } from "../handler";

const workspaceRepository = new SqlGuestWorkspaceRepository();
const handlers = createSavedAnalysisHandlers({
  runtimeSafe: hasSafeGuestRuntime,
  readWorkspace: readGuestWorkspace,
  isWorkspaceActive: (id, now) => workspaceRepository.isActive(id, now),
  repository: savedAnalysisRepository,
});

export async function GET(
  request: Request,
  context: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await context.params;
  return handlers.detail(request, analysisId);
}
