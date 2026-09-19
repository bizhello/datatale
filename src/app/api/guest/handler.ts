import type { GuestWorkspace } from "@/entities/guest-workspace";
import type { GuestWorkspaceRepository } from "@/entities/guest-workspace/server";
import { isSameOrigin, privateJson } from "../private-http";

type GuestHandlerDependencies = Readonly<{
  runtimeSafe(): boolean;
  bootstrap(): Promise<GuestWorkspace | undefined>;
  readSession(): Promise<GuestWorkspace | undefined>;
  clearSession(): Promise<void>;
  repository: GuestWorkspaceRepository;
  deleteWorkspace(id: string): Promise<boolean>;
}>;

export function createGuestHandlers(dependencies: GuestHandlerDependencies) {
  return {
    async post(request: Request) {
      if (!dependencies.runtimeSafe())
        return privateJson({ code: "unavailable" }, 503);
      if (!isSameOrigin(request)) return privateJson({ code: "csrf" }, 403);
      try {
        const workspace = await dependencies.bootstrap();
        return workspace
          ? privateJson({ expiresAt: workspace.expiresAt }, 200)
          : privateJson({ code: "unavailable" }, 503);
      } catch {
        return privateJson({ code: "unavailable" }, 503);
      }
    },

    async delete(request: Request) {
      if (!dependencies.runtimeSafe())
        return privateJson({ code: "unavailable" }, 503);
      if (!isSameOrigin(request)) return privateJson({ code: "csrf" }, 403);
      const workspace = await dependencies.readSession();
      if (!workspace) return privateJson({ code: "expired" }, 401);
      try {
        if (
          !(await dependencies.repository.isActive(workspace.id, new Date()))
        ) {
          await dependencies.clearSession();
          return privateJson({ code: "expired" }, 401);
        }
        await dependencies.deleteWorkspace(workspace.id);
        await dependencies.clearSession();
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "private, no-store" },
        });
      } catch {
        return privateJson({ code: "unavailable" }, 503);
      }
    },
  };
}
