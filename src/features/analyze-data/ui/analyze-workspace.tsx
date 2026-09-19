"use client";
import { Button, Skeleton } from "@heroui/react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { ReportDashboard } from "@/entities/report";
import { analysisErrorMessages } from "../model/analysis-state";
import { useAnalysis } from "../model/use-analysis";

type AnalyzeWorkspaceProps = {
  source: Dataset | TextSource;
  onDelete: () => void;
};
export function AnalyzeWorkspace({ source, onDelete }: AnalyzeWorkspaceProps) {
  const { state, run, cancel, retry } = useAnalysis(source);
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
        <div aria-live="polite" className="report-loading">
          <p>{state.stage}</p>
          <div className="loading-metrics" aria-hidden="true">
            <Skeleton className="metric-skeleton" />
            <Skeleton className="metric-skeleton" />
            <Skeleton className="metric-skeleton" />
          </div>
          <Skeleton className="hero-skeleton" />
          <Skeleton className="chart-skeleton" />
          <Button variant="secondary" onPress={cancel}>
            Отменить анализ
          </Button>
        </div>
      )}
      {state.status === "error" && (
        <div className="error-state" role="alert">
          <div>
            <h2>Анализ не завершён</h2>
            <p>{analysisErrorMessages[state.error]}</p>
            <Button onPress={retry}>Повторить</Button>
          </div>
        </div>
      )}
      {state.status === "ready" && <ReportDashboard report={state.report} />}
      <Button className="delete-session" variant="tertiary" onPress={onDelete}>
        Удалить все данные этого сеанса
      </Button>
    </section>
  );
}
