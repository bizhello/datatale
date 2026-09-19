import {
  CHAT_HISTORY_MAX_MESSAGES,
  type ChatMessage,
  type ChatResult,
  chatResultSchema,
} from "@/entities/chat";
import { datasetSchema, textSourceSchema } from "@/entities/dataset";
import {
  readGuestWorkspace,
  SqlGuestWorkspaceRepository,
} from "@/entities/guest-workspace/server";
import { finalReportSchema } from "@/entities/report";
import type { SavedAnalysisMessage } from "@/entities/saved-analysis";
import { answerChat } from "@/features/query-report/server";
import { hasSafeAnalysisRuntime } from "@/shared/config";
import { savedAnalysisRepository } from "../saved-analysis-runtime";
import { createChatHandler } from "./handler";

const CHAT_DAILY_LIMIT = 10;
const ASSISTANT_SUFFIX = ":assistant";
const workspaceRepository = new SqlGuestWorkspaceRepository();

function assistantId(messageId: string) {
  return `${messageId}${ASSISTANT_SUFFIX}`;
}

function messageContent(result: ChatResult) {
  return result.outcome === "answered" ? result.answer : result.message;
}

async function history(
  workspaceId: string,
  analysisId: string,
): Promise<ReadonlyArray<SavedAnalysisMessage>> {
  return savedAnalysisRepository.messages({
    workspaceId,
    analysisId,
    limit: CHAT_HISTORY_MAX_MESSAGES,
  });
}

export const POST = createChatHandler({
  runtimeSafe: hasSafeAnalysisRuntime,
  readWorkspace: readGuestWorkspace,
  isWorkspaceActive: (id, now) => workspaceRepository.isActive(id, now),
  readReply: async ({ workspaceId, analysisId, messageId }) => {
    const stored = (await history(workspaceId, analysisId)).find(
      (message) => message.id === assistantId(messageId),
    );
    if (!stored?.result) return undefined;
    const parsed = chatResultSchema.safeParse(stored.result);
    return parsed.success ? parsed.data : undefined;
  },
  claimQuestion: async ({ workspaceId, request }) => {
    const stored = await savedAnalysisRepository.appendMessage({
      workspaceId,
      analysisId: request.analysisId,
      dailyLimit: CHAT_DAILY_LIMIT,
      message: {
        id: request.messageId,
        role: "user",
        content: request.question,
      },
    });
    if (stored === "quota-exceeded") return "quota";
    return stored ? "claimed" : "missing";
  },
  claimInference: ({ workspaceId, analysisId, messageId }) =>
    savedAnalysisRepository.claimInference({
      workspaceId,
      analysisId,
      messageId,
    }),
  releaseInference: ({ analysisId, messageId, token }) =>
    savedAnalysisRepository.releaseInference({ analysisId, messageId, token }),
  answer: ({ workspaceId, request, signal }) =>
    answerChat(request, {
      signal,
      loadContext: async (analysisId, contextSignal) => {
        if (contextSignal.aborted) return undefined;
        const [stored, storedMessages] = await Promise.all([
          savedAnalysisRepository.get(workspaceId, analysisId),
          history(workspaceId, analysisId),
        ]);
        if (!stored || contextSignal.aborted) return undefined;
        const dataset = datasetSchema.safeParse(stored.source);
        const text = dataset.success
          ? undefined
          : textSourceSchema.safeParse(stored.source);
        const report = finalReportSchema.safeParse(stored.report);
        if ((!dataset.success && !text?.success) || !report.success)
          return undefined;
        const source = dataset.success ? dataset.data : text?.data;
        if (!source) return undefined;
        const messages: ChatMessage[] = storedMessages.flatMap((message) => {
          if (
            message.id === request.messageId ||
            message.id === assistantId(request.messageId)
          )
            return [];
          if (message.role === "assistant" && message.result) {
            const result = chatResultSchema.safeParse(message.result);
            if (result.success)
              return [
                {
                  role: "assistant" as const,
                  content: messageContent(result.data),
                },
              ];
          }
          return [{ role: message.role, content: message.content }];
        });
        return {
          analysisId,
          source,
          report: report.data,
          history: messages,
        };
      },
    }),
  saveReply: async ({ workspaceId, request, result }) =>
    Boolean(
      await savedAnalysisRepository.appendMessage({
        workspaceId,
        analysisId: request.analysisId,
        dailyLimit: CHAT_DAILY_LIMIT,
        message: {
          id: assistantId(request.messageId),
          role: "assistant",
          content: messageContent(result),
          result,
        },
      }),
    ),
});
