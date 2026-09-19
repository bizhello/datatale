import { Button } from "@heroui/react";
import styles from "./ask-data.module.css";

type SuggestedQuestionsProps = {
  questions: readonly string[];
  onSelect: (question: string) => void;
};

export function SuggestedQuestions({
  questions,
  onSelect,
}: SuggestedQuestionsProps) {
  return (
    <div className={styles.suggestions}>
      <p>Можно спросить:</p>
      <div className={styles.suggestionList}>
        {questions.map((question) => (
          <Button
            key={question}
            size="sm"
            variant="outline"
            onPress={() => onSelect(question)}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
