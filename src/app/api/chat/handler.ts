import { z } from "zod";
import {
  type ChatRequest,
  type ChatResult,
  chatRequestSchema,
  chatResultSchema,
} from "@/entities/chat";
import type { GuestWorkspace } from "@/entities/guest-workspace";
import { ChatProviderError } from "@/features/query-report/server";
import {
  BodyTooLargeError,
  isSameOrigin,
  privateJson,
  readBoundedBody,
} from "../private-http";

const CHAT_REQUEST_MAX_BYTES = 4 * 1024;

type ClaimOutcome = "claimed" | "existing" | "missing" | "quota";

type ChatHandlerDependencies = Readonly<{
  runtimeSafe(): boolean;
  readWorkspace(): Promise<GuestWorkspace | undefined>;
  isWorkspaceActive(id: string, now: Date): Promise<boolean>;
  readReply(input: {
    workspaceId: string;
    analysisId: string;
    messageId: string;
  }): Promise<ChatResult | undefined>;
  claimQuestion(input: {
    workspaceId: string;
    request: ChatRequest;
  }): Promise<ClaimOutcome>;
  answer(input: {
    workspaceId: string;
    request: ChatRequest;
    signal: AbortSignal;
  }): Promise<ChatResult>;
  saveReply(input: {
    workspaceId: string;
    request: ChatRequest;
    result: ChatResult;
  }): Promise<boolean>;
}>;

function parseRequest(body: string): ChatRequest | undefined {
  try {
    const parsed = chatRequestSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function providerFailure(error: ChatProviderError) {
  if (error.code === "provider_timeout")
    return privateJson({ code: "timeout" }, 504);
  if (error.code === "provider_aborted")
    return privateJson({ code: "cancelled" }, 499);
  if (error.code === "invalid_provider_output")
    return privateJson({ code: "invalid-answer" }, 502);
  return privateJson({ code: "provider" }, 502);
}

export function createChatHandler(dependencies: ChatHandlerDependencies) {
  return async function handleChat(request: Request) {
    if (!dependencies.runtimeSafe())
      return privateJson({ code: "unavailable" }, 503);
    if (!isSameOrigin(request)) return privateJson({ code: "csrf" }, 403);

    const workspace = await dependencies.readWorkspace();
    if (!workspace) return privateJson({ code: "expired" }, 401);
    try {
      if (!(await dependencies.isWorkspaceActive(workspace.id, new Date())))
        return privateJson({ code: "expired" }, 401);
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }

    let body: string;
    try {
      body = await readBoundedBody(request, CHAT_REQUEST_MAX_BYTES);
    } catch (error) {
      return error instanceof BodyTooLargeError
        ? privateJson({ code: "too-large" }, 413)
        : privateJson({ code: "invalid-request" }, 400);
    }
    const chatRequest = parseRequest(body);
    if (!chatRequest) return privateJson({ code: "invalid-request" }, 400);

    try {
      const replay = await dependencies.readReply({
        workspaceId: workspace.id,
        analysisId: chatRequest.analysisId,
        messageId: chatRequest.messageId,
      });
      if (replay) return privateJson(replay);

      const claim = await dependencies.claimQuestion({
        workspaceId: workspace.id,
        request: chatRequest,
      });
      if (claim === "missing") return privateJson({ code: "not-found" }, 404);
      if (claim === "quota") return privateJson({ code: "quota" }, 429);

      const afterClaimReplay = await dependencies.readReply({
        workspaceId: workspace.id,
        analysisId: chatRequest.analysisId,
        messageId: chatRequest.messageId,
      });
      if (afterClaimReplay) return privateJson(afterClaimReplay);

      const result = chatResultSchema.parse(
        await dependencies.answer({
          workspaceId: workspace.id,
          request: chatRequest,
          signal: request.signal,
        }),
      );
      if (
        !(await dependencies.saveReply({
          workspaceId: workspace.id,
          request: chatRequest,
          result,
        }))
      )
        return privateJson({ code: "unavailable" }, 503);
      return privateJson(result);
    } catch (error) {
      if (error instanceof ChatProviderError) return providerFailure(error);
      if (error instanceof z.ZodError)
        return privateJson({ code: "invalid-answer" }, 502);
      return privateJson({ code: "unavailable" }, 503);
    }
  };
}
