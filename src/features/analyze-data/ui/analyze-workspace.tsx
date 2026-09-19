"use client";
import { Button } from "@heroui/react";
import { useState } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { ReportDashboard } from "@/entities/report/ui";
import { analysisErrorMessages } from "../model/analysis-state";
import { useAnalysis } from "../model/use-analysis";
import { AnalysisProgress } from "./analysis-progress";

type AnalyzeWorkspaceProps = {
  source: Dataset | TextSource;
  onDelete: () => void;
};
export function AnalyzeWorkspace({ source, onDelete }: AnalyzeWorkspaceProps) {
  const { state, run, cancel, retry } = useAnalysis(source);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">(
    "idle",
  );
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
    <section className="analysis-workspace">
      {(state.status === "idle" || state.status === "cancelled") && (
        <Button onPress={() => void run()}>
          {state.status === "cancelled"
            ? "Запустить снова"
            : "Запустить анализ"}
        </Button>
      )}
      {state.status === "analyzing" && (
        <>
          <AnalysisProgress
            phase={state.phase}
            sourceKind={source.source.kind === "text" ? "text" : "table"}
          />
          <Button variant="secondary" onPress={cancel}>
            Отменить анализ
          </Button>
        </>
      )}
      {state.status === "error" && (
        <div className="error-state" role="alert">
          <div>
            <h2>Анализ не завершён</h2>
            <p>{analysisErrorMessages[state.error]}</p>
            {state.retryable && <Button onPress={retry}>Повторить</Button>}
          </div>
        </div>
      )}
      {state.status === "ready" && <ReportDashboard report={state.report} />}
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
