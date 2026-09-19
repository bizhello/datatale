"use client";
import { Button, Skeleton } from "@heroui/react";
import { useState } from "react";
import { type FinalReport, ReportDashboard } from "@/entities/report";
import type { Dataset, TextSource } from "@/entities/dataset";

type AnalyzeWorkspaceProps = {
  source: Dataset | TextSource;
  onDelete: () => void;
};
export function AnalyzeWorkspace({ source, onDelete }: AnalyzeWorkspaceProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">(
    "idle",
  );
  const [report, setReport] = useState<FinalReport>();
  const [error, setError] = useState("");
  async function run() {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        !result ||
        typeof result !== "object" ||
        !("report" in result)
      )
        throw new Error(
          "Анализ временно недоступен. Проверьте подключение и повторите попытку.",
        );
      setReport((result as { report: FinalReport }).report);
      setStatus("ready");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить анализ.",
      );
      setStatus("error");
    }
  }
  return (
    <section className="analysis-workspace">
      {status === "idle" && <Button onPress={run}>Запустить анализ</Button>}
      {status === "loading" && (
        <div aria-live="polite" className="report-loading">
          <p>Проверяем план и считаем показатели…</p>
          <Skeleton className="report-skeleton" />
          <Skeleton className="report-skeleton" />
        </div>
      )}
      {status === "error" && (
        <div className="error-state" role="alert">
          <p>{error}</p>
          <Button onPress={run}>Повторить</Button>
        </div>
      )}
      {status === "ready" && report && <ReportDashboard report={report} />}
      <Button variant="tertiary" onPress={onDelete}>
        Удалить все данные этого сеанса
      </Button>
    </section>
  );
}
