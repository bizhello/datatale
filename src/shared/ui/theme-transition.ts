import type { ThemeMode } from "./theme-control.types";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasResolvedThemeClass(mode: ThemeMode, root: HTMLElement) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return root.classList.contains("dark") === dark;
}

export async function waitForResolvedTheme(mode: ThemeMode, root: HTMLElement) {
  const deadline = performance.now() + 160;
  while (!hasResolvedThemeClass(mode, root) && performance.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
  }
}
