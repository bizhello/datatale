import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AskDataClientError,
  type AskDataResult,
  type AskDataSend,
  MAX_QUESTION_LENGTH,
} from "../model/types";
import { AskDataPanel } from "./ask-data-panel";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function enterQuestion(question: string) {
  const input = screen.getByRole("textbox", { name: "Ваш вопрос к отчёту" });
  fireEvent.change(input, { target: { value: question } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("AskDataPanel", () => {
  it("submits a question and renders a grounded answer with evidence", async () => {
    const send = vi.fn(async () => ({
      status: "answered" as const,
      answer: "Продажи выросли.",
      evidenceLabels: ["Продажи по месяцам"],
    }));
    render(<AskDataPanel send={send} />);

    enterQuestion("Что выросло?");

    expect(await screen.findByText("Продажи выросли.")).toBeVisible();
    expect(screen.getByText("Продажи по месяцам")).toBeVisible();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        question: "Что выросло?",
      }),
      expect.any(AbortSignal),
    );
  });

  it("renders the exact insufficient-data refusal", async () => {
    const send = vi.fn(
      async (): Promise<AskDataResult> => ({ status: "insufficient_data" }),
    );
    render(<AskDataPanel send={send} />);
    enterQuestion("Какой прогноз на 2030 год?");
    expect(
      await screen.findByText("В этом отчете нет такой информации"),
    ).toBeVisible();
  });

  it("renders an unsupported-operation result", async () => {
    const send = vi.fn(
      async (): Promise<AskDataResult> => ({
        status: "unsupported_operation",
        message: "Я не выполняю прогнозы.",
      }),
    );
    render(<AskDataPanel send={send} />);
    enterQuestion("Постройте прогноз");
    expect(await screen.findByText("Я не выполняю прогнозы.")).toBeVisible();
  });

  it("shows an actionable retry and preserves the message id", async () => {
    const first = deferred<AskDataResult>();
    const send = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        status: "answered",
        answer: "Повторный ответ.",
      });
    render(<AskDataPanel send={send} />);
    enterQuestion("Сколько строк?");
    first.reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Проверьте соединение",
    );
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(await screen.findByText("Повторный ответ.")).toBeVisible();
    expect(screen.getAllByText("Сколько строк?")).toHaveLength(1);
    expect(send.mock.calls[0]?.[0].messageId).toBe(
      send.mock.calls[1]?.[0].messageId,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Ваш вопрос к отчёту" }),
      ).toHaveFocus(),
    );
  });

  it("does not offer retry for a non-retryable client error", async () => {
    const send = vi.fn(async () => {
      throw new AskDataClientError("Invalid request", { retryable: false });
    });
    render(<AskDataPanel send={send} />);
    enterQuestion("Недопустимый вопрос");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "сформулировать вопрос иначе",
    );
    expect(screen.queryByRole("button", { name: /Повторить/ })).toBeNull();
  });

  it.each([
    ["expired", "Срок действия гостевого сеанса истёк"],
    ["not-found", "Этот отчёт больше недоступен"],
    ["quota", "Лимит вопросов к отчёту на сегодня исчерпан"],
    ["in-flight", "Этот вопрос уже обрабатывается"],
  ] as const)("explains %s without offering retry", async (code, message) => {
    const send = vi.fn(async () => {
      throw new AskDataClientError(code, { code, retryable: false });
    });
    const view = render(<AskDataPanel send={send} />);
    enterQuestion("Какой итог?");
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: /Повторить/ })).toBeNull();
    view.unmount();
  });

  it("cancels a pending request and ignores its late result", async () => {
    const request = deferred<AskDataResult>();
    const nextRequest = deferred<AskDataResult>();
    const send = vi
      .fn<AskDataSend>()
      .mockReturnValueOnce(request.promise)
      .mockReturnValueOnce(nextRequest.promise);
    render(<AskDataPanel send={send} />);
    enterQuestion("Отменяемый вопрос");
    const signal = send.mock.calls[0]?.[1];
    fireEvent.click(screen.getByRole("button", { name: /Отменить/ }));
    expect(signal?.aborted).toBe(true);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Ваш вопрос к отчёту" }),
      ).toHaveFocus(),
    );
    request.resolve({ status: "answered", answer: "Поздний ответ" });
    await waitFor(() => expect(screen.queryByText("Поздний ответ")).toBeNull());
    enterQuestion("Новый вопрос");
    request.resolve({ status: "answered", answer: "Ещё один поздний ответ" });
    nextRequest.resolve({ status: "answered", answer: "Актуальный ответ" });
    expect(await screen.findByText("Актуальный ответ")).toBeVisible();
    expect(screen.queryByText("Ещё один поздний ответ")).toBeNull();
  });

  it("prevents duplicate submits while a request is pending", () => {
    const request = deferred<AskDataResult>();
    const send = vi.fn<AskDataSend>(() => request.promise);
    render(<AskDataPanel send={send} />);
    enterQuestion("Один вопрос");
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Ваш вопрос к отчёту" }),
      { key: "Enter" },
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("supports Shift+Enter and enforces the maximum length", () => {
    const send = vi.fn(
      async (): Promise<AskDataResult> => ({
        status: "answered",
        answer: "ok",
      }),
    );
    render(<AskDataPanel send={send} />);
    const input = screen.getByRole("textbox", { name: "Ваш вопрос к отчёту" });
    fireEvent.change(input, { target: { value: "первая" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(input, {
      target: { value: "x".repeat(MAX_QUESTION_LENGTH + 1) },
    });
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent ===
          `${MAX_QUESTION_LENGTH + 1} / ${MAX_QUESTION_LENGTH}`,
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Спросить/ })).toBeDisabled();
  });

  it("focuses a selected suggestion and exposes accessible status", () => {
    const send = vi.fn(
      async (): Promise<AskDataResult> => ({
        status: "answered",
        answer: "ok",
      }),
    );
    render(<AskDataPanel send={send} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Какие главные выводы?" }),
    );
    expect(
      screen.getByRole("textbox", { name: "Ваш вопрос к отчёту" }),
    ).toHaveFocus();
    expect(screen.getByText("21 / 500")).toBeVisible();
  });
});
