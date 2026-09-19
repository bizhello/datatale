import {
  readGuestWorkspace,
  saveInviteCodeFingerprint,
} from "@/entities/guest-workspace/server";
import {
  hashIp,
  inviteFingerprint,
  isValidInviteCode,
  SqlAccessRepository,
} from "@/features/analyze-data/server";
import { hasSafeAccessRuntime } from "@/shared/config";
import { createAccessHandler } from "./handler";

const repository = new SqlAccessRepository();
export const POST = createAccessHandler({
  runtimeSafe: hasSafeAccessRuntime,
  readWorkspace: readGuestWorkspace,
  hashIp,
  allowInvalidAttempt: (ipHash) => repository.allowInvalidAttempt(ipHash),
  saveCapability: saveInviteCodeFingerprint,
  fingerprint: inviteFingerprint,
  validCode: isValidInviteCode,
});
