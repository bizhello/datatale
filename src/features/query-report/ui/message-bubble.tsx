import { Chip } from "@heroui/react";
import type { AskDataMessage } from "../model/types";
import styles from "./ask-data.module.css";

type MessageBubbleProps = { message: AskDataMessage };

const messageKindLabel = {
  clarification: "Нужно уточнение",
  not_in_source: "Нет в источнике",
  unsupported: "Операция недоступна",
} as const;

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div
      className={`${styles.messageRow} ${isUser ? styles.userRow : styles.assistantRow}`}
    >
      <article
        aria-label={isUser ? "Ваш вопрос" : "Ответ DataTale"}
        className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}
      >
        {message.kind &&
        message.kind !== "not_in_source" &&
        message.kind in messageKindLabel ? (
          <Chip className={styles.outcome ?? ""} size="sm" variant="secondary">
            {messageKindLabel[message.kind as keyof typeof messageKindLabel]}
          </Chip>
        ) : null}
        <p>{message.text}</p>
        {message.evidenceLabels?.length ? (
          <div className={styles.evidence}>
            {message.evidenceLabels.map((label) => (
              <Chip key={label} size="sm" variant="secondary">
                {label}
              </Chip>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
}
