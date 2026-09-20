"use client";

import { ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ThemeMode } from "./theme-control.types";
import { prefersReducedMotion, waitForResolvedTheme } from "./theme-transition";

const themeOptions: ReadonlyArray<{
  icon: typeof Sun;
  label: string;
  mode: ThemeMode;
}> = [
  { icon: Sun, label: "Светлая тема", mode: "light" },
  { icon: Moon, label: "Тёмная тема", mode: "dark" },
  { icon: Monitor, label: "Системная тема", mode: "system" },
];

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
    <div id="onboarding-theme">
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
              onPress={(event) =>
                changeTheme(mode, event.target as HTMLElement)
              }
            >
              <Icon className="theme-icon" aria-hidden="true" />
            </ToggleButton>
            <Tooltip.Content>{label}</Tooltip.Content>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
