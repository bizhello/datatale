"use client";
import { Chip, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { BarChart3, BookOpen, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AnalyzeWorkspace } from "@/features/analyze-data";
import { ImportWorkspace } from "@/features/import-data";
import type { Dataset, TextSource } from "@/entities/dataset";

export function DashboardShell() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<Dataset | TextSource>();
  useEffect(() => setMounted(true), []);
  const selectedMode =
    mounted && (theme === "light" || theme === "dark" || theme === "system")
      ? theme
      : "system";
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
          <ToggleButtonGroup
            aria-label="Тема оформления"
            className="theme-selector"
            disallowEmptySelection
            selectedKeys={new Set([selectedMode])}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const [mode] = keys;
              if (mode === "light" || mode === "dark" || mode === "system") {
                setTheme(mode);
              }
            }}
          >
            <Tooltip delay={0}>
              <ToggleButton
                className="theme-control"
                id="light"
                isIconOnly
                aria-label="Светлая тема"
              >
                <Sun className="theme-icon" aria-hidden="true" />
              </ToggleButton>
              <Tooltip.Content>Светлая тема</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <ToggleButton
                className="theme-control"
                id="dark"
                isIconOnly
                aria-label="Тёмная тема"
              >
                <Moon className="theme-icon" aria-hidden="true" />
              </ToggleButton>
              <Tooltip.Content>Тёмная тема</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <ToggleButton
                className="theme-control"
                id="system"
                isIconOnly
                aria-label="Системная тема"
              >
                <Monitor className="theme-icon" aria-hidden="true" />
              </ToggleButton>
              <Tooltip.Content>Системная тема</Tooltip.Content>
            </Tooltip>
          </ToggleButtonGroup>
        </div>
      </header>
      <main id="main">
        <ImportWorkspace onReady={setSource} />
        {source && (
          <AnalyzeWorkspace
            source={source}
            onDelete={() => setSource(undefined)}
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
