import { Alert, Button, Label, ListBox, Select } from "@heroui/react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { isTextSource } from "../lib/source-guards";
import type { ReadyState } from "../model/import-workspace-state";
import { TablePreview } from "./table-preview";

type SourcePreviewProps = {
  state: ReadyState;
  onSheet: (value: string) => void;
  onClear: () => void;
  onAnalyze?: (source: Dataset | TextSource) => void;
};

export function SourcePreview({
  state,
  onSheet,
  onClear,
  onAnalyze,
}: SourcePreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const source = state.result.source;
  const text = isTextSource(source) ? source : undefined;
  const data = isTextSource(source) ? undefined : source;
  const sheets = state.result.sheetNames ?? [];
  return (
    <motion.div
      className="preview"
      aria-live="polite"
      initial={prefersReducedMotion ? false : { opacity: 1, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.18,
        ease: "easeOut",
      }}
    >
      <div className="preview-header">
        <div>
          <p className="eyebrow">ПРОВЕРЕННЫЙ ИСТОЧНИК</p>
          <h2>
            <CheckCircle2 aria-hidden="true" />
            {text
              ? "Текст готов к анализу"
              : (state.file?.name ?? "Таблица готова к анализу")}
          </h2>
          <p>
            {text
              ? `${text.paragraphs.length} абз. · ${text.rawText.length.toLocaleString("ru-RU")} символов`
              : `${data?.rows.length.toLocaleString("ru-RU")} строк · ${data?.columns.length} столбцов`}
          </p>
          {state.isDemo ? (
            <p className="demo-source">
              Синтетический демо-набор · не AI-анализ
            </p>
          ) : null}
        </div>
        <Button variant="tertiary" onPress={onClear}>
          <X /> Убрать
        </Button>
      </div>
      {sheets.length > 1 && (
        <Select
          className="sheet-select"
          value={state.selectedSheet ?? null}
          variant="secondary"
          onChange={(value) => {
            if (typeof value === "string") onSheet(value);
          }}
        >
          <Label>Лист</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {sheets.map((name) => (
                <ListBox.Item key={name} id={name} textValue={name}>
                  {name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      )}
      {state.result.warnings.length > 0 && (
        <Alert className="warning" role="status" status="warning">
          <Alert.Indicator>
            <AlertTriangle aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Предупреждение при обработке источника</Alert.Title>
            <Alert.Description>
              {state.result.warnings.map((warning) => (
                <span className="warning-message" key={warning.code}>
                  {warning.message}
                </span>
              ))}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {text ? (
        <article className="text-preview">
          <h3>Исходный текст</h3>
          {text.paragraphs.slice(0, 3).map((paragraph) => (
            <p key={paragraph.index}>{paragraph.text}</p>
          ))}
        </article>
      ) : (
        data && <TablePreview data={data} />
      )}
      {onAnalyze ? (
        <div className="analysis-action">
          <p className="analysis-note">
            Полный проверенный источник будет передан AI-провайдеру. Его правила
            хранения действуют отдельно. Принятые данные, отчёт и чат хранятся в
            этом гостевом пространстве 7 дней с момента анализа; просмотр не
            продлевает срок. Исходный CSV или XLSX файл не сохраняется, а
            счётчики безопасности удаляются не позднее чем через 48 часов.
          </p>
          <Button onPress={() => onAnalyze(source)}>
            Продолжить к анализу
          </Button>
        </div>
      ) : (
        <p className="analysis-note">
          Источник проверен. Анализ и сохранение отчёта появятся в следующем
          этапе.
        </p>
      )}
    </motion.div>
  );
}
