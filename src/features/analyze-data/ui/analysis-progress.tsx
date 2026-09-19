"use client";

import { ProgressBar, Skeleton } from "@heroui/react";
import { Check, LoaderCircle } from "lucide-react";
import type { AnalysisPhase } from "../model/analysis-state";

type AnalysisProgressProps = {
  phase: AnalysisPhase;
  sourceKind: "table" | "text";
  progress: number;
};

const tableStages = [
  { id: "session", label: "Подготавливаем защищённый сеанс" },
  { id: "plan", label: "Выбор и проверка плана" },
  { id: "calculate", label: "Детерминированный расчёт" },
  { id: "narrative", label: "Формирование итогового повествования" },
] as const;

const textStages = [
  { id: "session", label: "Подготавливаем защищённый сеанс" },
  { id: "extract", label: "Извлечение проверяемых фактов" },
  { id: "calculate", label: "Проверка расчётов" },
  { id: "narrative", label: "Формирование итогового повествования" },
] as const;

export function AnalysisProgress({
  phase,
  progress,
  sourceKind,
}: AnalysisProgressProps) {
  const stages = sourceKind === "text" ? textStages : tableStages;
  const activeIndex = phase === "session-setup" ? 0 : 1;
  const activeLabel =
    stages[activeIndex]?.label ?? stages[0]?.label ?? "Анализ";
  const statusLabel =
    progress >= 100
      ? "Анализ завершён"
      : progress >= 95
        ? "Почти закончили — ждём ответ AI"
        : activeLabel;

  return (
    <div className="report-loading">
      <div className="analysis-progress-heading">
        <span className="analysis-progress-icon" aria-hidden="true">
          <LoaderCircle className="spin" />
        </span>
        <div>
          <h2>Готовим анализ</h2>
          <p aria-live="polite" role="status">
            {statusLabel}…
          </p>
        </div>
      </div>
      <ProgressBar
        aria-label="Оценка хода анализа, приблизительно"
        className="analysis-progress-bar"
        maxValue={100}
        value={progress}
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <p className="analysis-progress-estimate">
        Оценка, не измерение: {progress}%
      </p>
      <ol className="analysis-progress-stages" aria-label="Этапы анализа">
        {stages.map((stage, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          return (
            <li
              className={isActive ? "is-active" : undefined}
              aria-current={isActive ? "step" : undefined}
              key={stage.id}
            >
              <span className="analysis-stage-marker" aria-hidden="true">
                {isComplete ? <Check /> : index + 1}
              </span>
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="loading-metrics" aria-hidden="true">
        <Skeleton className="metric-skeleton" />
        <Skeleton className="metric-skeleton" />
        <Skeleton className="metric-skeleton" />
      </div>
      <Skeleton className="hero-skeleton" />
      <Skeleton className="chart-skeleton" />
    </div>
  );
}
