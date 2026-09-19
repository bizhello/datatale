import "server-only";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { type GuestWorkspace, guestWorkspaceSchema } from "./model/schema";

type GuestSession = Partial<GuestWorkspace> & {
  destroy(): void;
  save(): Promise<void>;
};
const maxAge = 30 * 24 * 60 * 60;
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
  return parsed.success ? parsed.data : undefined;
}
export async function clearGuestSession() {
  const session = await getGuestSession();
  if (session) {
    session.destroy();
    await session.save();
  }
}
