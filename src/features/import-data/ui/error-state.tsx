import { Button } from "@heroui/react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
  onClear: () => void;
  retryable: boolean;
  sheetNames?: string[] | undefined;
  onSheet: (value: string) => void;
};

export function ErrorState({
  message,
  onRetry,
  onClear,
  retryable,
  sheetNames,
  onSheet,
}: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>Не получилось загрузить источник</strong>
        <p>{message}</p>
        {sheetNames && sheetNames.length > 1 ? (
          <label className="sheet-select">
            Попробовать другой лист
            <select
              defaultValue=""
              onChange={(event) => onSheet(event.target.value)}
            >
              <option value="" disabled>
                Выберите лист
              </option>
              {sheetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="error-actions">
          {retryable && (
            <Button variant="secondary" onPress={onRetry}>
              <RotateCcw /> Повторить
            </Button>
          )}
          <Button variant="tertiary" onPress={onClear}>
            Начать заново
          </Button>
        </div>
      </div>
    </div>
  );
}
