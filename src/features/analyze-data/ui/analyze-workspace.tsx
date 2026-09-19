"use client";
import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { ReportDashboard } from "@/entities/report/ui";
import {
  analysisErrorMessages,
  type QuotaScope,
} from "../model/analysis-state";
import { type RestoredAnalysis, useAnalysis } from "../model/use-analysis";
import { AnalysisProgress } from "./analysis-progress";
import { InviteAccessModal } from "./invite-access-modal";

type AnalyzeWorkspaceProps = {
  source: Dataset | TextSource;
  onDelete: () => void;
  restoredAnalysis?: RestoredAnalysis;
  onAnalysisReady?: () => void;
  renderReport?: (
    analysisId: string,
    report: FinalReport,
    expiresAt: string,
  ) => ReactNode;
};
export function AnalyzeWorkspace({
  source,
  onDelete,
  renderReport,
  restoredAnalysis,
  onAnalysisReady,
}: AnalyzeWorkspaceProps) {
  const { state, run, cancel, retry } = useAnalysis(source, restoredAnalysis);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">(
    "idle",
  );
  const [accessOpen, setAccessOpen] = useState(false);
  useEffect(() => {
    if (state.status === "ready") onAnalysisReady?.();
  }, [onAnalysisReady, state.status]);
  useEffect(() => {
    if (
      state.status === "error" &&
      state.error === "quota" &&
      (state.quotaScope === "workspace" || state.quotaScope === "ip")
    )
      setAccessOpen(true);
  }, [state]);
  const deleteAll = async () => {
    setDeleteState("deleting");
    try {
      const response = await fetch("/api/guest", { method: "DELETE" });
      if (!response.ok && response.status !== 401)
        throw new Error("Delete failed.");
      cancel();
      onDelete();
    } catch {
      setDeleteState("error");
    }
  };
  return (
    <section
      className="analysis-workspace"
      id="onboarding-analysis-flow"
      tabIndex={-1}
    >
      {(state.status === "idle" || state.status === "cancelled") && (
        <Button onPress={() => void run()}>
          {state.status === "cancelled"
            ? "Запустить снова"
            : "Запустить анализ"}
        </Button>
      )}
      {(state.status === "analyzing" || state.status === "completing") && (
        <>
          <AnalysisProgress
            progress={state.progress}
            phase={state.phase}
            sourceKind={source.source.kind === "text" ? "text" : "table"}
          />
          {state.status === "analyzing" && (
            <Button variant="secondary" onPress={cancel}>
              Отменить анализ
            </Button>
          )}
        </>
      )}
      {state.status === "error" && (
        <div className="error-state" role="alert">
          <div>
            <h2>Анализ не завершён</h2>
            <p>{errorMessage(state.error, state.quotaScope)}</p>
            {state.retryable && <Button onPress={retry}>Повторить</Button>}
          </div>
        </div>
      )}
      {state.status === "ready" &&
        (renderReport?.(state.analysisId, state.report, state.expiresAt) ?? (
          <ReportDashboard report={state.report} expiresAt={state.expiresAt} />
        ))}
      <InviteAccessModal
        isOpen={accessOpen}
        onOpenChange={setAccessOpen}
        onUnlocked={() => void run()}
      />
      {deleteState === "error" && (
        <div className="error-state" role="alert">
          <div>
            <h2>Не удалось удалить данные</h2>
            <p>Сеанс и показанный источник сохранены. Повторите удаление.</p>
            <Button onPress={() => void deleteAll()}>Повторить удаление</Button>
          </div>
        </div>
      )}
      <Button
        className="delete-session"
        variant="tertiary"
        isDisabled={deleteState === "deleting"}
        onPress={() => void deleteAll()}
      >
        {deleteState === "deleting"
          ? "Удаляем данные…"
          : "Удалить все данные этого сеанса"}
      </Button>
    </section>
  );
}

function errorMessage(
  error: keyof typeof analysisErrorMessages,
  scope?: QuotaScope,
) {
  if (error !== "quota") return analysisErrorMessages[error];
  if (scope === "code")
    return "Лимит этого кода приглашения на сегодня исчерпан.";
  if (scope === "global") return "Общий лимит анализов на сегодня исчерпан.";
  return analysisErrorMessages.quota;
}
