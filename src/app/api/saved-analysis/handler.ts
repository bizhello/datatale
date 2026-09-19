import { z } from "zod";
import { chatResultSchema } from "@/entities/chat";
import { datasetSchema, textSourceSchema } from "@/entities/dataset";
import type { GuestWorkspace } from "@/entities/guest-workspace";
import { finalReportSchema } from "@/entities/report";
import type {
  SavedAnalysisRepository,
  SavedAnalysisSummary,
} from "@/entities/saved-analysis/server";
import { privateJson } from "../private-http";

type SavedAnalysisHandlerDependencies = Readonly<{
  runtimeSafe(): boolean;
  readWorkspace(): Promise<GuestWorkspace | undefined>;
  isWorkspaceActive(id: string, now: Date): Promise<boolean>;
  repository: Pick<
    SavedAnalysisRepository,
    "listSummaries" | "get" | "messages"
  >;
}>;

const analysisIdSchema = z.string().uuid();

function summaryJson(summary: SavedAnalysisSummary) {
  return {
    id: summary.id,
    sourceKind: summary.sourceKind,
    createdAt: summary.createdAt.toISOString(),
    expiresAt: summary.expiresAt.toISOString(),
  };
}

export function createSavedAnalysisHandlers(
  dependencies: SavedAnalysisHandlerDependencies,
) {
  async function workspace() {
    const current = await dependencies.readWorkspace();
    if (!current) return undefined;
    return (await dependencies.isWorkspaceActive(current.id, new Date()))
      ? current
      : undefined;
  }

  return {
    async list(request: Request) {
      if (!dependencies.runtimeSafe())
        return privateJson({ code: "unavailable" }, 503);
      if (request.method !== "GET")
        return privateJson({ code: "forbidden" }, 403);
      try {
        const current = await workspace();
        if (!current) return privateJson({ code: "expired" }, 401);
        const summaries = await dependencies.repository.listSummaries(
          current.id,
        );
        return privateJson({ analyses: summaries.map(summaryJson) });
      } catch {
        return privateJson({ code: "unavailable" }, 503);
      }
    },

    async detail(request: Request, analysisId: string) {
      if (!dependencies.runtimeSafe())
        return privateJson({ code: "unavailable" }, 503);
      if (request.method !== "GET")
        return privateJson({ code: "forbidden" }, 403);
      if (!analysisIdSchema.safeParse(analysisId).success)
        return privateJson({ code: "not-found" }, 404);
      try {
        const current = await workspace();
        if (!current) return privateJson({ code: "expired" }, 401);
        const analysis = await dependencies.repository.get(
          current.id,
          analysisId,
        );
        if (!analysis) return privateJson({ code: "not-found" }, 404);
        const source = datasetSchema.safeParse(analysis.source);
        const text = textSourceSchema.safeParse(analysis.source);
        const report = finalReportSchema.safeParse(analysis.report);
        if ((!source.success && !text.success) || !report.success)
          return privateJson({ code: "unavailable" }, 503);
        const messages = await dependencies.repository.messages({
          workspaceId: current.id,
          analysisId,
        });
        if (
          messages.some(
            (message) =>
              (message.role === "assistant" &&
                (message.result === undefined ||
                  !chatResultSchema.safeParse(message.result).success)) ||
              (message.role === "user" && message.result !== undefined),
          )
        )
          return privateJson({ code: "unavailable" }, 503);
        return privateJson({
          analysisId: analysis.id,
          source: source.success ? source.data : text.data,
          report: report.data,
          expiresAt: analysis.expiresAt.toISOString(),
          messages,
        });
      } catch {
        return privateJson({ code: "unavailable" }, 503);
      }
    },
  };
}
