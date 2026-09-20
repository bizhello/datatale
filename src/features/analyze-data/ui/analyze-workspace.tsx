"use client";
import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  type Dataset,
  sourceDisplaySummary,
  type TextSource,
} from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { ReportDashboard } from "@/entities/report/ui";
import { canUnlockAnalysis, errorMessage } from "../model/analysis-error";
import type { AnalysisFocus } from "../model/analysis-focus";
import { type RestoredAnalysis, useAnalysis } from "../model/use-analysis";
import { AnalysisProgress } from "./analysis-progress";

type AnalyzeWorkspaceProps = {
  source: Dataset | TextSource;
  onDelete: () => void;
  onReplace: () => void;
  analysisFocus?: AnalysisFocus;
  autoStart?: boolean;
  restoredAnalysis?: RestoredAnalysis;
  onAnalysisReady?: () => void;
  onAccessRequired?: (resume: () => void) => void;
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
  onAccessRequired,
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  useEffect(() => {
    if (state.status === "ready") onAnalysisReady?.();
  }, [onAnalysisReady, state.status]);
  useEffect(() => {
    if (
      state.status === "error" &&
      canUnlockAnalysis(state.error, state.quotaScope)
    )
      onAccessRequired?.(() => void run());
  }, [onAccessRequired, run, state]);
  const stateError = state.status === "error" ? state.error : undefined;
  const stateQuotaScope =
    state.status === "error" ? state.quotaScope : undefined;
  const canUnlock =
    state.status === "error" &&
    canUnlockAnalysis(state.error, state.quotaScope);
  useEffect(() => {
    if (state.status === "analyzing") progressRef.current?.focus();
    if (
      state.status === "error" &&
      !(
        stateError !== undefined &&
        canUnlockAnalysis(stateError, stateQuotaScope)
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
        <Button variant="secondary" onPress={onReplace}>
          {state.status === "ready"
            ? "Создать новый отчёт"
            : "Выбрать другой источник"}
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
            <div className="error-actions">
              {state.retryable && <Button onPress={retry}>Повторить</Button>}
              {canUnlock && onAccessRequired && (
                <Button onPress={() => onAccessRequired?.(() => void run())}>
                  Ввести код доступа
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {state.status === "ready" &&
        (renderReport?.(state.analysisId, state.report, state.expiresAt) ?? (
          <ReportDashboard report={state.report} expiresAt={state.expiresAt} />
        ))}
      {deleteState === "error" && (
        <div className="error-state" role="alert">
          <div>
            <h2>Не удалось удалить данные</h2>
            <p>Сеанс и показанный источник сохранены. Повторите удаление.</p>
            <Button onPress={() => void deleteAll()}>Повторить удаление</Button>
          </div>
        </div>
      )}
      <div className="analysis-danger-zone">
        <p>
          Удаление очистит все отчёты, чат и источник этого гостевого
          пространства.
        </p>
        <Button
          className="delete-session"
          variant="danger-soft"
          isDisabled={deleteState === "deleting"}
          onPress={() => setDeleteConfirmOpen(true)}
        >
          {deleteState === "deleting"
            ? "Удаляем данные…"
            : "Удалить сохранённые данные"}
        </Button>
      </div>
      <Modal.Root
        isOpen={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Удалить данные пространства?</Modal.Heading>
                <Modal.CloseTrigger aria-label="Закрыть" />
              </Modal.Header>
              <Modal.Body>
                <p>
                  Будут удалены все текущие отчёты, сообщения чата и источник.
                  Это действие нельзя отменить.
                </p>
                <div className="modal-actions">
                  <Button
                    variant="tertiary"
                    onPress={() => setDeleteConfirmOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="danger"
                    onPress={() => {
                      setDeleteConfirmOpen(false);
                      void deleteAll();
                    }}
                  >
                    Удалить всё
                  </Button>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </section>
  );
}
