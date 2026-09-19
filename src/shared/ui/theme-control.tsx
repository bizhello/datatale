"use client";

import { ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const themeOptions: ReadonlyArray<{
  icon: typeof Sun;
  label: string;
  mode: ThemeMode;
}> = [
  { icon: Sun, label: "Светлая тема", mode: "light" },
  { icon: Moon, label: "Тёмная тема", mode: "dark" },
  { icon: Monitor, label: "Системная тема", mode: "system" },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasResolvedThemeClass(mode: ThemeMode, root: HTMLElement) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return root.classList.contains("dark") === dark;
}

async function waitForResolvedTheme(mode: ThemeMode, root: HTMLElement) {
  const deadline = performance.now() + 160;
  while (!hasResolvedThemeClass(mode, root) && performance.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
  }
}

export function ThemeControl() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selectedMode: ThemeMode =
    mounted && (theme === "light" || theme === "dark" || theme === "system")
      ? theme
      : "system";

  function changeTheme(mode: ThemeMode, origin: HTMLElement) {
    const root = document.documentElement;
    const transition = document.startViewTransition;
    if (!transition || prefersReducedMotion()) {
      setTheme(mode);
      return;
    }

    const bounds = origin.getBoundingClientRect();
    root.style.setProperty("--theme-x", `${bounds.left + bounds.width / 2}px`);
    root.style.setProperty("--theme-y", `${bounds.top + bounds.height / 2}px`);

    transition.call(document, async () => {
      setTheme(mode);
      await waitForResolvedTheme(mode, root);
    });
  }

  return (
    <ToggleButtonGroup
      aria-label="Тема оформления"
      className="theme-selector"
      disallowEmptySelection
      selectedKeys={new Set([selectedMode])}
      selectionMode="single"
    >
      {themeOptions.map(({ icon: Icon, label, mode }) => (
        <Tooltip key={mode} delay={0}>
          <ToggleButton
            className="theme-control"
            id={mode}
            isIconOnly
            aria-label={label}
            onPress={(event) => changeTheme(mode, event.target as HTMLElement)}
          >
            <Icon className="theme-icon" aria-hidden="true" />
          </ToggleButton>
          <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
