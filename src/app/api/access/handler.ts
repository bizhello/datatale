import { z } from "zod";
import { isSameOrigin, privateJson, readBoundedBody } from "../private-http";

const bodySchema = z
  .object({ code: z.string().trim().min(1).max(256) })
  .strict();
type AccessDependencies = Readonly<{
  runtimeSafe(): boolean;
  readWorkspace(): Promise<{ id: string } | undefined>;
  hashIp(ip: string): string | undefined;
  allowInvalidAttempt(ipHash: string): Promise<boolean>;
  saveCapability(fingerprint: string): Promise<boolean>;
  fingerprint(code: string): string;
  validCode(code: string): boolean;
}>;
function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
export function createAccessHandler(dependencies: AccessDependencies) {
  return async (request: Request) => {
    if (!dependencies.runtimeSafe())
      return privateJson({ code: "unavailable" }, 503);
    if (!isSameOrigin(request)) return privateJson({ code: "csrf" }, 403);
    if (!(await dependencies.readWorkspace()))
      return privateJson({ code: "expired" }, 401);
    const ipHash = dependencies.hashIp(requestIp(request));
    if (!ipHash) return privateJson({ code: "unavailable" }, 503);
    let body: unknown;
    try {
      body = JSON.parse(await readBoundedBody(request, 4096));
    } catch {
      body = undefined;
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success || !dependencies.validCode(parsed.data.code)) {
      try {
        if (!(await dependencies.allowInvalidAttempt(ipHash)))
          return privateJson({ code: "rate-limited" }, 429);
      } catch {
        return privateJson({ code: "unavailable" }, 503);
      }
      return privateJson({ code: "invalid-code" }, 401);
    }
    try {
      if (
        !(await dependencies.saveCapability(
          dependencies.fingerprint(parsed.data.code),
        ))
      )
        return privateJson({ code: "unavailable" }, 503);
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }
    return privateJson({ unlocked: true });
  };
}
