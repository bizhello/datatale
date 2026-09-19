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
import { useHistory } from "../model/use-history";
import { HistoryPicker } from "./history-picker";
import { OnboardingDemo } from "./onboarding-demo";

export function DashboardShell() {
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<Dataset | TextSource>();
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const {
    analyses: history,
    selected: selectedHistory,
    loading: historyLoading,
    error: historyError,
    opening: openingHistory,
    openError: historyOpenError,
    retryId: historyRetryId,
    load: loadHistory,
    open: openHistory,
    sourceReady,
    deleteAll: clearHistory,
  } = useHistory();
  const refreshHistory = useCallback(() => void loadHistory(), [loadHistory]);
  const handleSourceReady = useCallback(
    (next: Dataset | TextSource) => {
      sourceReady();
      setSource(next);
    },
    [sourceReady],
  );
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!selectedHistory) return;
    setSource(selectedHistory.source);
    const focus = () =>
      document.getElementById("onboarding-analysis-flow")?.focus();
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(focus);
    else setTimeout(focus, 0);
  }, [selectedHistory]);
  const handleDelete = useCallback(() => {
    clearHistory();
    setSource(undefined);
    setWorkspaceVersion((version) => version + 1);
  }, [clearHistory]);
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
          opening={openingHistory}
          openError={historyOpenError}
          loaded={Boolean(selectedHistory)}
          onOpen={(id) => void openHistory(id)}
          onRetry={() => {
            if (historyRetryId) void openHistory(historyRetryId);
          }}
          onRetryList={() => void loadHistory()}
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
              onDelete={handleDelete}
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
