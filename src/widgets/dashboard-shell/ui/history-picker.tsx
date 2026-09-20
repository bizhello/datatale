"use client";
import { Button, Label, ListBox, Select, Spinner } from "@heroui/react";
import type { HistorySummary } from "../model/history";
import { historyLabel } from "../model/history-label";

type HistoryPickerProps = {
  analyses: HistorySummary[];
  loading: boolean;
  error: boolean;
  opening: boolean;
  openError: boolean;
  loaded: boolean;
  onOpen: (id: string) => void;
  onRetry: () => void;
  onRetryList: () => void;
};

export function HistoryPicker({
  analyses,
  loading,
  error,
  opening,
  openError,
  loaded,
  onOpen,
  onRetry,
  onRetryList,
}: HistoryPickerProps) {
  if (loading)
    return (
      <div
        aria-live="polite"
        className="history-picker history-picker-loading"
        role="status"
      >
        <Spinner aria-hidden="true" size="sm" />
        <span>Загружаем историю отчётов…</span>
      </div>
    );
  if (error)
    return (
      <div aria-live="polite" className="history-picker">
        <span>История отчётов временно недоступна.</span>
        <Button size="sm" variant="secondary" onPress={onRetryList}>
          Повторить
        </Button>
      </div>
    );
  if (!analyses.length) return null;
  return (
    <div className="history-picker">
      <p aria-live="polite" className="history-picker-live">
        {opening ? "Открываем отчёт…" : loaded ? "Отчёт открыт." : ""}
      </p>
      {openError ? (
        <div className="history-picker-error" role="alert">
          <span>Не удалось открыть отчёт.</span>
          <Button size="sm" variant="secondary" onPress={onRetry}>
            Повторить
          </Button>
        </div>
      ) : null}
      <Select
        aria-label="Сохранённые отчёты"
        isDisabled={opening}
        placeholder={opening ? "Открываем отчёт…" : "Открыть отчёт"}
        onChange={(value) => {
          if (typeof value === "string") onOpen(value);
        }}
      >
        <Label>Сохранённые отчёты</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {analyses.map((analysis) => (
              <ListBox.Item
                key={analysis.id}
                id={analysis.id}
                textValue={historyLabel(analysis)}
              >
                {historyLabel(analysis)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
