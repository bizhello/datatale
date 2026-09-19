import "server-only";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { analysisLimits } from "@/shared/config";
import { type GuestWorkspace, guestWorkspaceSchema } from "./model/schema";

type GuestSession = Partial<GuestWorkspace> & {
  inviteCodeFingerprint?: string;
  destroy(): void;
  save(): Promise<void>;
};
const maxAge = analysisLimits.workspaceDays * 24 * 60 * 60;
function options() {
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32) return undefined;
  const production = process.env.NODE_ENV === "production";
  return {
    cookieName: production ? "__Host-datatale" : "datatale",
    password,
    ttl: maxAge,
    cookieOptions: {
      httpOnly: true,
      secure: production,
      sameSite: "lax" as const,
      path: "/",
      maxAge,
    },
  };
}
export async function getGuestSession(): Promise<GuestSession | undefined> {
  const config = options();
  return config
    ? getIronSession<GuestSession>(await cookies(), config)
    : undefined;
}
export async function readGuestWorkspace() {
  const session = await getGuestSession();
  if (!session) return undefined;
  const parsed = guestWorkspaceSchema.safeParse({
    id: session.id,
    expiresAt: session.expiresAt,
  });
  return parsed.success && Date.parse(parsed.data.expiresAt) > Date.now()
    ? parsed.data
    : undefined;
}

export async function saveGuestWorkspace(workspace: GuestWorkspace) {
  const session = await getGuestSession();
  if (!session) return false;
  session.id = workspace.id;
  session.expiresAt = workspace.expiresAt;
  await session.save();
  return true;
}

export async function clearGuestSession() {
  const session = await getGuestSession();
  if (session) {
    session.destroy();
    await session.save();
  }
}

export async function readInviteCodeFingerprint() {
  const session = await getGuestSession();
  return session?.inviteCodeFingerprint;
}

export async function saveInviteCodeFingerprint(fingerprint: string) {
  const session = await getGuestSession();
  if (!session) return false;
  session.inviteCodeFingerprint = fingerprint;
  await session.save();
  return true;
}
