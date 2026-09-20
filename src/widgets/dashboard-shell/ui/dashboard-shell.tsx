"use client";
import { BarChart3, BookOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { ReportDashboard } from "@/entities/report/ui";
import {
  type AnalysisFocus,
  AnalysisLaunchPanel,
  AnalyzeWorkspace,
} from "@/features/analyze-data";
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
  const [analysisFocus, setAnalysisFocus] = useState<AnalysisFocus>();
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const handleAccessLost = useCallback(() => {
    setSource(undefined);
    setWorkspaceVersion((version) => version + 1);
  }, []);
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
  } = useHistory({ onAccessLost: handleAccessLost });
  const refreshHistory = useCallback(() => void loadHistory(), [loadHistory]);
  const handleSourceReady = useCallback(
    (next: Dataset | TextSource, focus?: AnalysisFocus) => {
      sourceReady();
      setSource(next);
      setAnalysisFocus(focus);
    },
    [sourceReady],
  );
  const handleReplace = useCallback(() => {
    sourceReady();
    setSource(undefined);
    setAnalysisFocus(undefined);
    setWorkspaceVersion((version) => version + 1);
  }, [sourceReady]);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (selectedHistory) setSource(selectedHistory.source);
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
          datatale
        </a>
        <div className="header-actions">
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
        {!source && (
          <ImportWorkspace
            key={workspaceVersion}
            renderReadyAction={(next) => (
              <AnalysisLaunchPanel
                onLaunch={(focus) => handleSourceReady(next, focus)}
              />
            )}
          />
        )}
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
              autoStart
              analysisFocus={analysisFocus}
              {...(selectedHistory
                ? { restoredAnalysis: selectedHistory }
                : {})}
              onAnalysisReady={refreshHistory}
              onReplace={handleReplace}
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
        <div className="footer-copy">
          <strong className="footer-brand-name">datatale</strong>
          <span className="footer-tagline">
            Данные превращаются в понятную историю
          </span>
        </div>
        <div className="footer-actions">
          <span className="footer-trust">
            <BarChart3 size={14} aria-hidden="true" /> Проверяем расчёты
          </span>
          <OnboardingTour
            hydrated={mounted}
            onSessionChange={setOnboardingActive}
          />
        </div>
      </footer>
    </div>
  );
}
