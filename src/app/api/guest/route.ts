import {
  bootstrapGuestWorkspace,
  clearGuestSession,
  readGuestWorkspace,
  SqlGuestWorkspaceRepository,
  saveGuestWorkspace,
} from "@/entities/guest-workspace/server";
import { deleteAnalysisWorkspace } from "@/features/analyze-data/server";
import { hasSafeAnalysisRuntime, hasSafeGuestRuntime } from "@/shared/config";
import { createGuestHandlers } from "./handler";

const repository = new SqlGuestWorkspaceRepository();
const handlers = createGuestHandlers({
  postRuntimeSafe: hasSafeAnalysisRuntime,
  deleteRuntimeSafe: hasSafeGuestRuntime,
  repository,
  readSession: readGuestWorkspace,
  clearSession: clearGuestSession,
  deleteWorkspace: deleteAnalysisWorkspace,
  bootstrap: () =>
    bootstrapGuestWorkspace({
      repository,
      readSession: readGuestWorkspace,
      saveSession: saveGuestWorkspace,
    }),
});

export const POST = handlers.post;
export const DELETE = handlers.delete;
