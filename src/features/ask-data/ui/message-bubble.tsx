import { Chip } from "@heroui/react";
import type { AskDataMessage } from "../model/types";
import styles from "./ask-data.module.css";

type MessageBubbleProps = { message: AskDataMessage };

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
