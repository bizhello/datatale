import { Button } from "@heroui/react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { isTextSource } from "../lib/source-guards";
import type { ReadyState } from "../model/import-workspace-state";
import { TablePreview } from "./table-preview";

type SourcePreviewProps = {
  state: ReadyState;
  onSheet: (value: string) => void;
  onClear: () => void;
};

export function SourcePreview({ state, onSheet, onClear }: SourcePreviewProps) {
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
        <label className="sheet-select">
          Лист{" "}
          <select
            value={state.selectedSheet ?? ""}
            onChange={(event) => onSheet(event.target.value)}
          >
            {sheets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {state.result.warnings.length > 0 && (
        <div className="warning" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            {state.result.warnings.map((warning) => (
              <p key={warning.code}>{warning.message}</p>
            ))}
          </div>
        </div>
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
      <p className="analysis-note">
        Источник проверен. Анализ и сохранение отчёта появятся в следующем
        этапе.
      </p>
    </motion.div>
  );
}
