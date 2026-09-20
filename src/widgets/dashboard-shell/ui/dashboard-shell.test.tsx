import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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

  it("runs exactly one guest bootstrap and analyze request under StrictMode", async () => {
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/saved-analysis")
          return Response.json({ analyses: [] });
        if (String(input) === "/api/guest")
          return Response.json({ expiresAt: "later" });
        expect(String(input)).toBe("/api/analyze");
        expect(init?.method).toBe("POST");
        return Response.json({ code: "unavailable" }, { status: 503 });
      },
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <StrictMode>
        <DashboardShell />
      </StrictMode>,
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Загрузить синтетический демо-набор",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Запустить AI-анализ" }),
    );
    await screen.findByRole("alert");

    expect(
      fetch.mock.calls.filter(([input]) => String(input) === "/api/guest"),
    ).toHaveLength(1);
    expect(
      fetch.mock.calls.filter(([input]) => String(input) === "/api/analyze"),
    ).toHaveLength(1);
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

  it("uses clear product copy in the header and footer", () => {
    render(<DashboardShell />);
    expect(
      screen.getByRole("link", { name: "DataTale — главная" }),
    ).toHaveTextContent("datatale");
    expect(screen.queryByText("Локальная проверка")).not.toBeInTheDocument();
    expect(
      screen.getByText("Данные превращаются в понятную историю"),
    ).toBeVisible();
    expect(screen.getByText("Проверяем расчёты")).toBeVisible();
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
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
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
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить сохранённые данные",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));
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
