import { Button, Skeleton } from "@heroui/react";
import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  onCancel: () => void;
  sheet?: string | undefined;
};

export function LoadingState({ onCancel, sheet }: LoadingStateProps) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-icon">
        <LoaderCircle className="spin" aria-hidden="true" />
      </span>
      <div>
        <strong>
          {sheet ? `Открываем лист «${sheet}»` : "Проверяем источник"}
        </strong>
        <p>
          {sheet
            ? "Выбираем лист в уже открытой книге."
            : "Читаем структуру и значения в отдельном процессе."}
        </p>
      </div>
      <Button variant="tertiary" onPress={onCancel}>
        Отменить
      </Button>
      <div className="skeleton-row" aria-hidden="true">
        <Skeleton className="skeleton-cell" />
        <Skeleton className="skeleton-cell" />
        <Skeleton className="skeleton-cell" />
      </div>
    </div>
  );
}
