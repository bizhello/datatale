import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "./theme-control";

const themeMock = vi.hoisted(() => ({
  setTheme: vi.fn((mode: string) => {
    document.documentElement.classList.toggle(
      "dark",
      mode === "dark" ||
        (mode === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }),
}));

const originalTransition = Object.getOwnPropertyDescriptor(
  document,
  "startViewTransition",
);

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: themeMock.setTheme, theme: "light" }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.documentElement.classList.remove("dark");
  if (originalTransition) {
    Object.defineProperty(document, "startViewTransition", originalTransition);
  } else {
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  }
});

describe("ThemeControl", () => {
  it("waits for the resolved class before updateCallbackDone", async () => {
    let updateCallbackDone: Promise<unknown> | undefined;
    const startViewTransition = vi.fn((callback: () => unknown) => {
      updateCallbackDone = Promise.resolve(callback());
      return { updateCallbackDone };
    });
    vi.stubGlobal("startViewTransition", startViewTransition);
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn() })),
    );
    themeMock.setTheme.mockImplementationOnce((mode) => {
      window.setTimeout(() => {
        document.documentElement.classList.toggle("dark", mode === "dark");
      }, 0);
    });

    render(<ThemeControl />);
    fireEvent.click(screen.getByRole("radio", { name: "Тёмная тема" }));
    await updateCallbackDone;

    expect(themeMock.setTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("uses the immediate fallback when reduced motion is requested", () => {
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        addEventListener: vi.fn(),
      })),
    );

    render(<ThemeControl />);
    fireEvent.click(screen.getByRole("radio", { name: "Тёмная тема" }));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(themeMock.setTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
