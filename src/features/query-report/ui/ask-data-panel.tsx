"use client";

import {
  Button,
  Description,
  Label,
  Spinner,
  Surface,
  TextArea,
  TextField,
} from "@heroui/react";
import { ArrowUp, RefreshCw, Square } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useId, useRef } from "react";
import {
  type AskDataMessage,
  type AskDataSend,
  MAX_QUESTION_LENGTH,
} from "../model/types";
import { useAskData } from "../model/use-ask-data";
import styles from "./ask-data.module.css";
import { MessageBubble } from "./message-bubble";
import { SuggestedQuestions } from "./suggested-questions";

export type AskDataPanelProps = {
  send: AskDataSend;
  onboardingDemo?: boolean;
  initialMessages?: AskDataMessage[];
};

const suggestions = [
  "Какие главные выводы?",
  "Что изменилось сильнее всего?",
  "Какие показатели стоит проверить?",
] as const;

export function AskDataPanel({
  send,
  onboardingDemo = false,
  initialMessages,
}: AskDataPanelProps) {
  const {
    messages,
    question,
    pending,
    error,
    retryQuestion,
    retryMessageId,
    setQuestion,
    submit,
    cancel,
  } = useAskData(send, initialMessages);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const questionHelpId = `${useId()}-question-help`;
  const scrollKey = `${messages.length}:${pending}:${error ?? ""}`;

  const restoreQuestionFocus = () => {
    const focus = () => inputRef.current?.focus();
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(focus);
    else setTimeout(focus, 0);
  };

  useEffect(() => {
    const log = logRef.current;
    if (log && scrollKey && typeof log.scrollTo === "function") {
      log.scrollTo({ top: log.scrollHeight });
    }
  }, [scrollKey]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const selectSuggestion = (value: string) => {
    setQuestion(value);
    inputRef.current?.focus();
  };

  return (
    <Surface
      data-onboarding-ask="true"
      className={styles.panel ?? ""}
      {...(!onboardingDemo ? { id: "onboarding-ask-data" } : {})}
      variant="default"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ОТЧЁТ</p>
          <h2>Спросите данные</h2>
          <p className={styles.subtitle}>
            Ответы основаны только на содержимом этого отчёта.
          </p>
        </div>
      </header>
      <div
        ref={logRef}
        aria-live="polite"
        aria-label="История вопросов и ответов"
        className={styles.messages}
        role="log"
        tabIndex={messages.length ? 0 : -1}
      >
        {!messages.length ? (
          <SuggestedQuestions
            onSelect={selectSuggestion}
            questions={suggestions}
          />
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {pending ? (
          <div className={`${styles.messageRow} ${styles.assistantRow}`}>
            <div
              aria-label="Готовим ответ"
              className={`${styles.bubble} ${styles.assistantBubble} ${styles.pending}`}
              role="status"
            >
              <Spinner size="sm" />
              <span>Проверяем отчёт…</span>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            {retryQuestion ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  void submit(retryQuestion, retryMessageId ?? undefined);
                  restoreQuestionFocus();
                }}
              >
                <RefreshCw aria-hidden="true" /> Повторить
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <form className={styles.form} onSubmit={onSubmit}>
        <TextField
          fullWidth
          name="ask-data-question"
          value={question}
          onChange={setQuestion}
          variant="secondary"
        >
          <Label>Ваш вопрос к отчёту</Label>
          <TextArea
            ref={inputRef}
            aria-describedby={questionHelpId}
            maxLength={MAX_QUESTION_LENGTH}
            onKeyDown={onKeyDown}
            placeholder="Например: какие месяцы были лучшими?"
            rows={2}
          />
          <Description id={questionHelpId}>
            <span>
              {question.length} / {MAX_QUESTION_LENGTH}
            </span>
            <span>Enter — отправить · Shift+Enter — новая строка</span>
          </Description>
        </TextField>
        <div className={styles.actions}>
          {pending ? (
            <Button
              aria-label="Отменить запрос"
              type="button"
              variant="tertiary"
              onPress={() => {
                cancel();
                restoreQuestionFocus();
              }}
            >
              <Square aria-hidden="true" /> Отменить
            </Button>
          ) : (
            <Button
              isDisabled={
                !question.trim() || question.length > MAX_QUESTION_LENGTH
              }
              type="submit"
            >
              <ArrowUp aria-hidden="true" /> Спросить
            </Button>
          )}
        </div>
      </form>
    </Surface>
  );
}
