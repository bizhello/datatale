import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/entities/dataset";
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

afterEach(() => vi.unstubAllGlobals());

describe("analysis workspace deletion", () => {
  it("opens invite access only for workspace quota and preserves the selected source", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "quota", scope: "workspace" }, { status: 429 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<AnalyzeWorkspace source={source} onDelete={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Запустить AI-анализ" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Продолжить анализ" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Код приглашения")).toBeVisible();
  });

  it("keeps code quota terminal and does not reopen the invite modal", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ expiresAt: "later" }))
      .mockResolvedValueOnce(
        Response.json({ code: "quota", scope: "code" }, { status: 429 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<AnalyzeWorkspace source={source} onDelete={vi.fn()} />);
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
    render(<AnalyzeWorkspace source={source} onDelete={onDelete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить все данные этого сеанса",
      }),
    );

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
    render(<AnalyzeWorkspace source={source} onDelete={onDelete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить все данные этого сеанса",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Удаляем данные…" }),
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
