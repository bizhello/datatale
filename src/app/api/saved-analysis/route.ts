import {
  readGuestWorkspace,
  SqlGuestWorkspaceRepository,
} from "@/entities/guest-workspace/server";
import { hasSafeGuestRuntime } from "@/shared/config";
import { savedAnalysisRepository } from "../saved-analysis-runtime";
import { createSavedAnalysisHandlers } from "./handler";

const workspaceRepository = new SqlGuestWorkspaceRepository();
const handlers = createSavedAnalysisHandlers({
  runtimeSafe: hasSafeGuestRuntime,
  readWorkspace: readGuestWorkspace,
  isWorkspaceActive: (id, now) => workspaceRepository.isActive(id, now),
  repository: savedAnalysisRepository,
});

export const GET = handlers.list;
