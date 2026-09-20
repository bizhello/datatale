import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { AnalyzeWorkspace } from "./analyze-workspace";

const source: Dataset = {
  version: 1,
  id: "source",
  source: { kind: "csv" },
  columns: [{ id: "value", label: "Value", scalarType: "number" }],
  rows: [
    {
      id: "row-1",
      values: { value: 1 },
      provenance: { sourceRowNumber: 2 },
    },
  ],
};
const report: FinalReport = {
  version: 1,
  hero: [
    {
      text: "Checked result.",
      factIds: ["count"],
      evidenceIds: [],
      kind: "observation",
    },
    {
      text: "Confirmed count.",
      factIds: ["count"],
      evidenceIds: [],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "count",
      label: "Count",
      value: 1,
      calculation: { kind: "count" },
      evidenceIds: ["rows"],
    },
  ],
  charts: [],
  evidence: [
    {
      id: "rows",
      kind: "row-range",
      label: "Rows",
      coverage: { included: 1, total: 1 },
    },
  ],
  recommendations: [],
  noChartReason: "No chart needed.",
};

afterEach(() => vi.unstubAllGlobals());

describe("analysis workspace", () => {
  it("focuses progress after launch and the report heading after completion", async () => {
    let resolveAnalysis: ((response: Response) => void) | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveAnalysis = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
        analysisFocus="compare regions"
        renderReport={() => (
          <h2 data-analysis-report-heading="true" tabIndex={-1}>
            Report
          </h2>
        )}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    const status = await screen.findByRole("status");
    await waitFor(() =>
      expect(document.activeElement).toContainElement(status),
    );

    resolveAnalysis?.(
      Response.json({
        analysisId: "00000000-0000-4000-8000-000000000009",
        report,
        expiresAt: "2026-09-26T12:00:00.000Z",
      }),
    );
    const heading = await screen.findByRole(
      "heading",
      { name: "Report" },
      { timeout: 2_500 },
    );
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("aborts and suppresses a stale result when the source is replaced", async () => {
    let requestSignal: AbortSignal | undefined;
    let resolveAnalysis: ((response: Response) => void) | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise<Response>((resolve, reject) => {
            requestSignal = options.signal;
            resolveAnalysis = resolve;
            options.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
    vi.stubGlobal("fetch", fetch);
    function Harness() {
      const [visible, setVisible] = useState(true);
      return visible ? (
        <AnalyzeWorkspace
          source={source}
          onDelete={vi.fn()}
          autoStart
          onReplace={() => setVisible(false)}
        />
      ) : (
        <p>Source replaced</p>
      );
    }
    render(<Harness />);
    await screen.findByRole("button", { name: "Отменить анализ" });
    fireEvent.click(
      screen.getByRole("button", { name: "Выбрать другой источник" }),
    );
    expect(requestSignal?.aborted).toBe(true);
    expect(await screen.findByText("Source replaced")).toBeVisible();
    resolveAnalysis?.(
      Response.json({
        analysisId: "00000000-0000-4000-8000-000000000009",
        report,
      }),
    );
    expect(screen.queryByText("Анализ завершён")).toBeNull();
  });

  it("keeps focus in the invite flow and preserves focus on the new-key retry", async () => {
    const firstKey = "00000000-0000-4000-8000-000000000002";
    const secondKey = "00000000-0000-4000-8000-000000000003";
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce(firstKey)
        .mockReturnValueOnce(secondKey),
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "quota", scope: "workspace" }, { status: 429 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "unavailable" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
        analysisFocus="find gaps"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    await screen.findByRole("heading", { name: "Продолжить анализ" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("dialog")),
    );
    fireEvent.change(screen.getByLabelText("Код приглашения"), {
      target: { value: "invite" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Разблокировать анализ" }),
    );
    await screen.findByRole("alert");
    const analyzeCalls = fetch.mock.calls.filter(
      ([input]) => String(input) === "/api/analyze",
    );
    expect(analyzeCalls).toHaveLength(2);
    expect(JSON.parse(String(analyzeCalls[0]?.[1]?.body))).toMatchObject({
      source,
      focus: "find gaps",
    });
    expect(JSON.parse(String(analyzeCalls[1]?.[1]?.body))).toMatchObject({
      source,
      focus: "find gaps",
    });
    expect(analyzeCalls[0]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": firstKey,
    });
    expect(analyzeCalls[1]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": secondKey,
    });
  });

  it("opens invite access only for workspace quota and preserves the selected source", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "quota", scope: "workspace" }, { status: 429 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Продолжить анализ" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Код приглашения")).toHaveClass(
      "input--secondary",
      "input--full-width",
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("dialog")),
    );
    expect(document.activeElement).not.toBe(
      document.querySelector('[role="alert"]'),
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Продолжить анализ" }),
      ).toBeNull(),
    );
    expect(
      screen.getByText(
        "Бесплатный анализ на сегодня использован. Продолжите с кодом приглашения.",
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Ввести код приглашения" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Продолжить анализ" }),
    ).toBeVisible();
  });

  it("moves focus to an actionable error while keeping replacement available", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "unavailable" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(screen.getByRole("button", { name: "Повторить" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Выбрать другой источник" }),
    ).toBeVisible();
  });

  it("keeps code quota terminal and does not reopen the invite modal", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "quota", scope: "code" }, { status: 429 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    expect(
      await screen.findByText(
        "Лимит этого кода приглашения на сегодня исчерпан.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Продолжить анализ" }),
    ).toBeNull();
  });

  it("clears local-only input when no guest workspace exists", async () => {
    const onDelete = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "expired" }, { status: 401 })),
    );
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={onDelete}
        onReplace={vi.fn()}
      />,
    );

    const deleteTrigger = screen.getByRole("button", {
      name: "Удалить сохранённые данные",
    });
    expect(deleteTrigger).toHaveClass("button--danger-soft");
    fireEvent.click(deleteTrigger);
    const confirm = screen.getByRole("button", { name: "Удалить всё" });
    expect(confirm).toHaveClass("button--danger");
    fireEvent.click(confirm);

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(screen.queryByText("Не удалось удалить данные")).toBeNull();
  });

  it("keeps client state after failure and clears it only after a successful retry", async () => {
    const onDelete = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ code: "unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    render(
      <AnalyzeWorkspace
        source={source}
        onDelete={onDelete}
        onReplace={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить сохранённые данные",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));
    expect(
      screen.getByRole("button", {
        name: "Удаляем данные…",
      }),
    ).toBeDisabled();
    expect(await screen.findByText("Не удалось удалить данные")).toBeVisible();
    expect(onDelete).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Повторить удаление" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/guest", {
      method: "DELETE",
    });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/guest", {
      method: "DELETE",
    });
  });
});
