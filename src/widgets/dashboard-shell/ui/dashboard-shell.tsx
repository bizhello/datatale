"use client";
import { Chip } from "@heroui/react";
import { BarChart3, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { AnalyzeWorkspace } from "@/features/analyze-data";
import { ImportWorkspace } from "@/features/import-data";
import { ThemeControl } from "@/shared/ui/theme-control";

export function DashboardShell() {
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<Dataset | TextSource>();
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
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
        <ImportWorkspace key={workspaceVersion} onReady={setSource} />
        {source && (
          <AnalyzeWorkspace
            key={source.id}
            source={source}
            onDelete={() => {
              setSource(undefined);
              setWorkspaceVersion((version) => version + 1);
            }}
          />
        )}
      </main>
      <footer>
        <span>DataTale / From data to a point of view</span>
        <span>
          <BarChart3 size={14} aria-hidden="true" /> Проверенный источник
        </span>
      </footer>
    </div>
  );
}
