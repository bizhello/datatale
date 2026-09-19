"use client";
import { Chip } from "@heroui/react";
import { BarChart3, BookOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { ReportDashboard } from "@/entities/report/ui";
import { AnalyzeWorkspace } from "@/features/analyze-data";
import { ImportWorkspace } from "@/features/import-data";
import { OnboardingTour } from "@/features/onboarding";
import { AskDataPanel, createAskDataSend } from "@/features/query-report";
import { ThemeControl } from "@/shared/ui/theme-control";
import {
  type HistoryDetail,
  type HistorySummary,
  historyDetailSchema,
  historyListSchema,
  restoreMessages,
} from "../model/history";
import { HistoryPicker } from "./history-picker";
import { OnboardingDemo } from "./onboarding-demo";

export function DashboardShell() {
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<Dataset | TextSource>();
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [history, setHistory] = useState<HistorySummary[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryDetail>();
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [openingHistoryId, setOpeningHistoryId] = useState<string>();
  const [historyRetryId, setHistoryRetryId] = useState<string>();
  const [historyOpenError, setHistoryOpenError] = useState(false);
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/saved-analysis", { method: "GET" });
      if (response.status === 401) {
        setHistory([]);
        setHistoryError(false);
        return;
      }
      if (!response.ok) throw new Error("History unavailable");
      const value = (await response.json()) as { analyses?: unknown };
      const parsed = historyListSchema.safeParse(value.analyses);
      if (!parsed.success) throw new Error("Invalid history");
      setHistory(parsed.data);
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, []);
  const refreshHistory = useCallback(() => void loadHistory(), [loadHistory]);
  const handleSourceReady = useCallback((next: Dataset | TextSource) => {
    setSelectedHistory(undefined);
    setSource(next);
  }, []);
  useEffect(() => void loadHistory(), [loadHistory]);
  const openHistory = async (id: string) => {
    setOpeningHistoryId(id);
    setHistoryRetryId(id);
    setHistoryOpenError(false);
    try {
      const response = await fetch(`/api/saved-analysis/${id}`, {
        method: "GET",
      });
      if (!response.ok) throw new Error("History item unavailable");
      const parsed = historyDetailSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Invalid history item");
      setSelectedHistory({
        ...parsed.data,
        messages: restoreMessages(parsed.data.messages),
      });
      setSource(parsed.data.source);
    } catch {
      setHistoryOpenError(true);
      await loadHistory();
    } finally {
      setOpeningHistoryId(undefined);
    }
  };
  useEffect(() => setMounted(true), []);
  return (
    <div className="page-shell" data-hydrated={mounted ? "true" : undefined}>
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <header className="site-header">
        <a href="/" className="brand" aria-label="DataTale — главная">
          <span className="brand-icon">
            <BookOpen size={20} aria-hidden="true" />
          </span>
          datatale<span className="brand-dot">.</span>
        </a>
        <div className="header-actions">
          <Chip className="local-badge" size="sm" variant="soft">
            Локальная проверка
          </Chip>
          <ThemeControl />
        </div>
      </header>
      <main id="main">
        <HistoryPicker
          analyses={history}
          error={historyError}
          loading={historyLoading}
          opening={openingHistoryId !== undefined}
          openError={historyOpenError}
          onOpen={(id) => void openHistory(id)}
          onRetry={() => {
            if (historyRetryId) void openHistory(historyRetryId);
          }}
        />
        <ImportWorkspace key={workspaceVersion} onReady={handleSourceReady} />
        {source && (
          <div
            aria-hidden={onboardingActive || undefined}
            className={
              onboardingActive ? "onboarding-workspace-hidden" : undefined
            }
          >
            <AnalyzeWorkspace
              key={`${source.id}:${selectedHistory?.analysisId ?? "new"}`}
              source={source}
              {...(selectedHistory
                ? { restoredAnalysis: selectedHistory }
                : {})}
              onAnalysisReady={refreshHistory}
              renderReport={(analysisId, report, expiresAt) => (
                <>
                  <ReportDashboard report={report} expiresAt={expiresAt} />
                  <AskDataPanel
                    key={analysisId}
                    {...(selectedHistory
                      ? { initialMessages: selectedHistory.messages }
                      : {})}
                    send={createAskDataSend(analysisId)}
                  />
                </>
              )}
              onDelete={() => {
                setSelectedHistory(undefined);
                setHistory([]);
                setSource(undefined);
                setWorkspaceVersion((version) => version + 1);
                void loadHistory();
              }}
            />
          </div>
        )}
        {onboardingActive && <OnboardingDemo />}
      </main>
      <footer>
        <span>DataTale / From data to a point of view</span>
        <span>
          <BarChart3 size={14} aria-hidden="true" /> Проверенный источник
        </span>
        <OnboardingTour
          hydrated={mounted}
          onSessionChange={setOnboardingActive}
        />
      </footer>
    </div>
  );
}
