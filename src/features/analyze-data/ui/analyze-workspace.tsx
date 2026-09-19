"use client";
import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  type Dataset,
  sourceDisplaySummary,
  type TextSource,
} from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { ReportDashboard } from "@/entities/report/ui";
import type { AnalysisFocus } from "../model/analysis-focus";
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
  onReplace?: () => void;
  analysisFocus?: AnalysisFocus;
  autoStart?: boolean;
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
  onReplace,
  analysisFocus,
  autoStart = false,
  renderReport,
  restoredAnalysis,
  onAnalysisReady,
}: AnalyzeWorkspaceProps) {
  const { state, run, cancel, retry } = useAnalysis(
    source,
    restoredAnalysis,
    analysisFocus,
  );
  const progressRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
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
  const stateError = state.status === "error" ? state.error : undefined;
  const stateQuotaScope =
    state.status === "error" ? state.quotaScope : undefined;
  useEffect(() => {
    if (state.status === "analyzing") progressRef.current?.focus();
    if (
      state.status === "error" &&
      !(
        stateError === "quota" &&
        (stateQuotaScope === "workspace" || stateQuotaScope === "ip")
      )
    )
      errorRef.current?.focus();
    if (state.status === "ready")
      document
        .querySelector<HTMLElement>("[data-analysis-report-heading]")
        ?.focus();
  }, [stateError, stateQuotaScope, state.status]);
  useEffect(() => {
    if (!autoStart || restoredAnalysis || state.status !== "idle") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void run();
    });
    return () => {
      cancelled = true;
    };
  }, [autoStart, restoredAnalysis, run, state.status]);
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
      <div className="compact-source-summary">
        <div>
          <p className="eyebrow">ПРОВЕРЕННЫЙ ИСТОЧНИК</p>
          <strong title={sourceDisplaySummary(source).name}>
            {sourceDisplaySummary(source).name}
          </strong>
          <span>{sourceDisplaySummary(source).detail}</span>
        </div>
        <Button variant="secondary" onPress={onReplace ?? onDelete}>
          Заменить источник
        </Button>
      </div>
      {((state.status === "idle" && !autoStart) ||
        state.status === "cancelled") && (
        <Button onPress={() => void run()}>Запустить AI-анализ</Button>
      )}
      {(state.status === "analyzing" || state.status === "completing") && (
        <>
          <div ref={progressRef} tabIndex={-1}>
            <AnalysisProgress
              progress={state.progress}
              phase={state.phase}
              sourceKind={source.source.kind === "text" ? "text" : "table"}
            />
          </div>
          {state.status === "analyzing" && (
            <Button variant="secondary" onPress={cancel}>
              Отменить анализ
            </Button>
          )}
        </>
      )}
      {state.status === "error" && (
        <div className="error-state" role="alert" tabIndex={-1} ref={errorRef}>
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
