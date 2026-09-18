import { Alert, Button, Label, ListBox, Select } from "@heroui/react";
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
    <Alert className="error-state" role="alert" status="danger">
      <Alert.Indicator>
        <AlertTriangle aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>Не получилось загрузить источник</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
        {sheetNames && sheetNames.length > 1 ? (
          <Select
            className="sheet-select"
            placeholder="Выберите лист"
            variant="secondary"
            onChange={(value) => {
              if (typeof value === "string") onSheet(value);
            }}
          >
            <Label>Попробовать другой лист</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {sheetNames.map((name) => (
                  <ListBox.Item key={name} id={name} textValue={name}>
                    {name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
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
      </Alert.Content>
    </Alert>
  );
}
