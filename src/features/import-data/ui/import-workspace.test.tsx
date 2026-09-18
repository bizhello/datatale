import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportError, type ImportResult } from "../model/types";

type Deferred = {
  promise: Promise<ImportResult>;
  resolve: (result: ImportResult) => void;
  reject: (reason: unknown) => void;
};

function deferred(): Deferred {
  let resolve: Deferred["resolve"] = () => undefined;
  let reject: Deferred["reject"] = () => undefined;
  const promise = new Promise<ImportResult>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const parser = vi.hoisted(() => vi.fn());
vi.mock("../model/parse-file", () => ({ parseFileInWorker: parser }));

import { ImportWorkspace } from "./import-workspace";

const sales = (sheet: string): ImportResult => ({
  source: {
    version: 1,
    id: sheet,
    source: { kind: "xlsx", filename: "sales.xlsx", sheet },
    columns: [{ id: "month", label: "Месяц", scalarType: "string" }],
    rows: [
      {
        id: "row-1",
        values: { month: sheet },
        provenance: { sourceRowNumber: 2 },
      },
    ],
  },
  warnings: [],
  sheetNames: ["Продажи", "Расходы"],
});

afterEach(() => parser.mockReset());

describe("ImportWorkspace", () => {
  it("clears accepted text and demo sources when removing them", async () => {
    render(<ImportWorkspace />);
    fireEvent.change(screen.getByLabelText("Текст отчёта"), {
      target: { value: "Первый абзац." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Проверить текст" }));
    expect(await screen.findByText("Текст готов к анализу")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Убрать" }));
    expect(screen.getByLabelText("Текст отчёта")).toHaveValue("");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Загрузить синтетический демо-набор",
      }),
    );
    expect(
      await screen.findByText("Синтетический демо-набор · не AI-анализ"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Убрать" }));
    expect(screen.getByLabelText("Текст отчёта")).toHaveValue("");
    expect(
      screen.queryByText("Синтетический демо-набор · не AI-анализ"),
    ).not.toBeInTheDocument();
  });

  it("does not silently truncate text beyond the acceptance limit", () => {
    render(<ImportWorkspace />);
    const source = "т".repeat(30_001);
    fireEvent.change(screen.getByLabelText("Текст отчёта"), {
      target: { value: source },
    });
    expect(screen.getByLabelText("Текст отчёта")).toHaveValue(source);
    fireEvent.click(screen.getByRole("button", { name: "Проверить текст" }));
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("keeps the workbook controller when selecting another sheet", async () => {
    const initial = deferred();
    const nextSheet = deferred();
    const selectSheet = vi.fn(() => nextSheet.promise);
    parser.mockReturnValue({
      promise: initial.promise,
      selectSheet,
      cancel: vi.fn(),
    });
    render(<ImportWorkspace />);
    const input = screen.getByLabelText("Выбрать CSV или XLSX файл");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["a"], "sales.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });
    initial.resolve(sales("Продажи"));
    expect(await screen.findByText("sales.xlsx")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Лист"), {
      target: { value: "Расходы" },
    });
    expect(selectSheet).toHaveBeenCalledWith("Расходы");
    nextSheet.resolve(sales("Расходы"));
    expect(await screen.findByRole("cell", { name: "Расходы" })).toBeVisible();
    expect(parser).toHaveBeenCalledTimes(1);
  });

  it("offers another workbook sheet after the first one is invalid", async () => {
    const initial = deferred();
    const nextSheet = deferred();
    const selectSheet = vi.fn(() => nextSheet.promise);
    parser.mockReturnValue({
      promise: initial.promise,
      selectSheet,
      cancel: vi.fn(),
    });
    render(<ImportWorkspace />);
    fireEvent.change(screen.getByLabelText("Выбрать CSV или XLSX файл"), {
      target: {
        files: [
          new File(["a"], "sales.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });
    initial.reject(
      new ImportError("В выбранном листе нет заголовка.", "empty-header", [
        "Продажи",
        "Расходы",
      ]),
    );
    expect(
      await screen.findByLabelText("Попробовать другой лист"),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Попробовать другой лист"), {
      target: { value: "Расходы" },
    });
    expect(selectSheet).toHaveBeenCalledWith("Расходы");
    nextSheet.resolve(sales("Расходы"));
    expect(await screen.findByRole("cell", { name: "Расходы" })).toBeVisible();
  });

  it("ignores a late parse completion after cancellation", async () => {
    const initial = deferred();
    const cancel = vi.fn();
    parser.mockReturnValue({
      promise: initial.promise,
      selectSheet: vi.fn(),
      cancel,
    });
    render(<ImportWorkspace />);
    fireEvent.change(screen.getByLabelText("Выбрать CSV или XLSX файл"), {
      target: {
        files: [
          new File(["a"], "sales.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Отменить" }));
    initial.resolve(sales("Продажи"));
    await Promise.resolve();
    expect(cancel).toHaveBeenCalled();
    expect(screen.queryByText("sales.xlsx")).not.toBeInTheDocument();
  });
});
