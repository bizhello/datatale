import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_STORAGE_KEY } from "@/features/onboarding";
import { DashboardShell } from "./dashboard-shell";

beforeEach(() =>
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "skipped"),
);
afterEach(() => vi.unstubAllGlobals());

describe("Dashboard input shell", () => {
  it("publishes the hydration readiness marker after mount", async () => {
    render(<DashboardShell />);
    await waitFor(() =>
      expect(document.querySelector(".page-shell")).toHaveAttribute(
        "data-hydrated",
        "true",
      ),
    );
  });

  it("reads history on mount without bootstrapping or analyzing", async () => {
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/saved-analysis");
        expect(init?.method).toBe("GET");
        return Response.json({ code: "expired" }, { status: 401 });
      },
    );
    vi.stubGlobal("fetch", fetch);
    render(<DashboardShell />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("exposes all theme modes as keyboard reachable controls", () => {
    render(<DashboardShell />);
    expect(screen.getByRole("radio", { name: "Светлая тема" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Тёмная тема" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Системная тема" })).toBeVisible();
  });

  it("offers local source choices", () => {
    render(<DashboardShell />);
    expect(
      screen.getByText(/Файлы сначала обрабатываются в этом браузере/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Загрузить синтетический демо-набор",
      }),
    ).toBeVisible();
  });
  it("accepts text and shows its exact source preview", () => {
    render(<DashboardShell />);
    fireEvent.change(screen.getByLabelText("Текст отчёта"), {
      target: { value: "Первый абзац.\n\nВторой абзац." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Проверить текст" }));
    expect(screen.getByText("Текст готов к анализу")).toBeVisible();
    expect(screen.getByText("Первый абзац.")).toBeVisible();
    expect(
      screen.getByText(
        /Полный проверенный источник будет передан AI-провайдеру/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Продолжить к анализу" }),
    ).toBeVisible();
  });

  it("resets imported source and analysis UI only after server deletion succeeds", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    render(<DashboardShell />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Загрузить синтетический демо-набор",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Продолжить к анализу" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить все данные этого сеанса",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Загрузить синтетический демо-набор",
        }),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole("button", { name: "Запустить анализ" }),
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/guest", { method: "DELETE" });
  });
});
