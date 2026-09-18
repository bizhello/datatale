"use client";
import { Button } from "@heroui/react";
import { BarChart3, BookOpen, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ImportWorkspace } from "@/features/import-data";
export function DashboardShell() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <div className="page-shell">
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
          <span className="local-badge">Локальная проверка</span>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
            onPress={() => setTheme(dark ? "light" : "dark")}
          >
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            aria-label="Использовать системную тему"
            onPress={() => setTheme("system")}
          >
            <Monitor aria-hidden="true" />
          </Button>
        </div>
      </header>
      <main id="main">
        <ImportWorkspace />
      </main>
      <footer>
        <span>DataTale / From data to a point of view</span>
        <span>
          <BarChart3 size={14} aria-hidden="true" /> Данные остаются в браузере
        </span>
      </footer>
    </div>
  );
}
