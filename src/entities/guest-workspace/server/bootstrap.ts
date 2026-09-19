import "server-only";
import { randomUUID } from "node:crypto";
import { analysisLimits } from "@/shared/config";
import type { GuestWorkspace } from "../model/schema";

export interface GuestWorkspaceRepository {
  isActive(id: string, now: Date): Promise<boolean>;
  create(workspace: GuestWorkspace): Promise<boolean>;
}

type BootstrapDependencies = Readonly<{
  repository: GuestWorkspaceRepository;
  readSession(): Promise<GuestWorkspace | undefined>;
  saveSession(workspace: GuestWorkspace): Promise<boolean>;
  now?: () => Date;
  createId?: () => string;
}>;

const workspaceTtlMs = analysisLimits.workspaceDays * 24 * 60 * 60_000;

export async function bootstrapGuestWorkspace({
  repository,
  readSession,
  saveSession,
  now = () => new Date(),
  createId = randomUUID,
}: BootstrapDependencies): Promise<GuestWorkspace | undefined> {
  const currentTime = now();
  const existing = await readSession();
  if (existing && (await repository.isActive(existing.id, currentTime)))
    return existing;

  const workspace = {
    id: createId(),
    expiresAt: new Date(currentTime.getTime() + workspaceTtlMs).toISOString(),
  };
  if (!(await repository.create(workspace))) return undefined;
  return (await saveSession(workspace)) ? workspace : undefined;
}
