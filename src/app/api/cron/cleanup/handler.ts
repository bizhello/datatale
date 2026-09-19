import { privateJson } from "../../private-http";

type CleanupHandlerDependencies = Readonly<{
  runtimeSafe(): boolean;
  secret(): string | undefined;
  cleanup(): Promise<number>;
}>;

export function createCleanupHandler(dependencies: CleanupHandlerDependencies) {
  return async function handleCleanup(request: Request) {
    const secret = dependencies.secret();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
      return privateJson({ code: "unauthorized" }, 401);
    if (!dependencies.runtimeSafe())
      return privateJson({ code: "unavailable" }, 503);
    try {
      return privateJson({ deleted: await dependencies.cleanup() });
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }
  };
}
