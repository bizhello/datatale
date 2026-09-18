"use client";

import { Button, Skeleton } from "@heroui/react";
import {
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { Dataset } from "@/entities/dataset";
import { normalizeTable, normalizeText } from "../model/normalize";
import { parseFileInWorker } from "../model/parse-file";
import type { ImportResult } from "../model/types";

const demo =
  "Месяц,Выручка,Заказы\nЯнварь,128000,120\nФевраль,146000,132\nМарт,171000,156\nАпрель,163000,149";

export function ImportWorkspace() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult>();
  const [file, setFile] = useState<File>();
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<(() => void) | undefined>(undefined);
  const acceptFile = useCallback(
    async (chosen: File, selectedSheet?: string) => {
      cancelRef.current?.();
      setLoading(true);
      setError("");
      setResult(undefined);
      setFile(chosen);
      const job = parseFileInWorker(chosen, selectedSheet);
      cancelRef.current = job.cancel;
      try {
        const next = await job.promise;
        setResult(next);
        setSheets(next.sheetNames ?? []);
        setSheet(
          selectedSheet ??
            (!isTextSource(next.source) && next.source.source.kind === "xlsx"
              ? (next.source.source.sheet ?? "")
              : ""),
        );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось обработать файл.",
        );
      } finally {
        setLoading(false);
        cancelRef.current = undefined;
      }
    },
    [],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    onDropAccepted: ([chosen]) => {
      if (chosen) void acceptFile(chosen);
    },
    onDropRejected: () =>
      setError("Выберите один CSV или XLSX-файл размером до 2 МБ."),
  });
  const useText = () => {
    try {
      setResult(normalizeText(text));
      setError("");
      setFile(undefined);
      setSheets([]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось принять текст.",
      );
    }
  };
  const clear = () => {
    cancelRef.current?.();
    setResult(undefined);
    setFile(undefined);
    setSheets([]);
    setSheet("");
    setError("");
    setLoading(false);
  };
  return (
    <section className="import-workspace" aria-labelledby="input-title">
      <div className="section-heading">
        <p className="eyebrow">ИСТОЧНИК ДАННЫХ</p>
        <h1 id="input-title">Начните с того, что у вас уже есть.</h1>
        <p>
          Файлы обрабатываются в этом браузере. Анализ пока недоступен — сначала
          проверьте источник.
        </p>
      </div>
      {!result && (
        <div className="input-grid">
          <div
            {...getRootProps({
              className: `dropzone ${isDragActive ? "dropzone-active" : ""}`,
            })}
          >
            <input {...getInputProps()} />
            <Upload aria-hidden="true" />
            <h2>CSV или Excel</h2>
            <p>
              Перетащите файл сюда или выберите его. До 2 МБ, до 5 000 строк.
            </p>
            <Button variant="secondary">
              <FileSpreadsheet /> Выбрать файл
            </Button>
            <small>XLS нужно сохранить как XLSX</small>
          </div>
          <div className="text-input">
            <FileText aria-hidden="true" />
            <h2>Или вставьте текст</h2>
            <label htmlFor="source-text">Текст отчёта</label>
            <textarea
              id="source-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Вставьте короткий отчёт или заметки…"
              maxLength={30_000}
            />
            <div>
              <span>{text.length.toLocaleString("ru-RU")} / 30 000</span>
              <Button variant="secondary" onPress={useText}>
                Проверить текст
              </Button>
            </div>
          </div>
        </div>
      )}
      {!result && !loading && (
        <Button
          className="demo-button"
          variant="ghost"
          onPress={() => {
            try {
              setResult(
                normalizeTable(
                  {
                    headers: ["Месяц", "Выручка", "Заказы"],
                    rows: [
                      ["Январь", "128000", "120"],
                      ["Февраль", "146000", "132"],
                      ["Март", "171000", "156"],
                      ["Апрель", "163000", "149"],
                    ],
                  },
                  { kind: "csv", filename: "demo.csv" },
                ),
              );
              setText(demo);
            } catch {}
          }}
        >
          Загрузить синтетический демо-набор
        </Button>
      )}
      {loading && (
        <div className="loading-state" aria-live="polite">
          <LoaderCircle className="spin" aria-hidden="true" />
          <div>
            <strong>Проверяем источник</strong>
            <p>Читаем структуру и значения в отдельном процессе.</p>
          </div>
          <Button variant="tertiary" onPress={clear}>
            Отменить
          </Button>
          <div className="skeleton-row">
            <Skeleton className="skeleton-cell" />
            <Skeleton className="skeleton-cell" />
            <Skeleton className="skeleton-cell" />
          </div>
        </div>
      )}
      {error && (
        <div className="error-state" role="alert">
          <strong>Не получилось загрузить источник</strong>
          <p>{error}</p>
          <Button variant="secondary" onPress={clear}>
            <RotateCcw /> Попробовать снова
          </Button>
        </div>
      )}
      {result && (
        <Preview
          result={result}
          file={file}
          sheets={sheets}
          sheet={sheet}
          onSheet={(value) => {
            setSheet(value);
            if (file) void acceptFile(file, value);
          }}
          onClear={clear}
        />
      )}
    </section>
  );
}

function isTextSource(
  source: ImportResult["source"],
): source is Extract<ImportResult["source"], { rawText: string }> {
  return "rawText" in source;
}
function Preview({
  result,
  file,
  sheets,
  sheet,
  onSheet,
  onClear,
}: {
  result: ImportResult;
  file: File | undefined;
  sheets: string[];
  sheet: string;
  onSheet: (value: string) => void;
  onClear: () => void;
}) {
  const text = isTextSource(result.source) ? result.source : undefined;
  const data = text ? undefined : (result.source as Dataset);
  return (
    <div className="preview" aria-live="polite">
      <div className="preview-header">
        <div>
          <p className="eyebrow">ПРОВЕРЕННЫЙ ИСТОЧНИК</p>
          <h2>
            {text
              ? "Текст готов к анализу"
              : (file?.name ?? "Таблица готова к анализу")}
          </h2>
          <p>
            {text
              ? `${text.paragraphs.length} абз. · ${text.rawText.length.toLocaleString("ru-RU")} символов`
              : `${data?.rows.length.toLocaleString("ru-RU")} строк · ${data?.columns.length} столбцов`}
          </p>
        </div>
        <Button variant="tertiary" onPress={onClear}>
          <X /> Убрать
        </Button>
      </div>
      {sheets.length > 1 && (
        <label className="sheet-select">
          Лист{" "}
          <select
            value={sheet}
            onChange={(event) => onSheet(event.target.value)}
          >
            {sheets.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      {result.warnings.length > 0 && (
        <div className="warning">
          {result.warnings.map((warning) => (
            <p key={warning.code}>{warning.message}</p>
          ))}
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
        data && (
          <div className="table-wrap">
            <p className="sample-label">
              Показаны первые {Math.min(data.rows.length, 12)} строк из{" "}
              {data.rows.length.toLocaleString("ru-RU")}
            </p>
            <table>
              <thead>
                <tr>
                  {data.columns.map((column) => (
                    <th key={column.id}>
                      {column.label}
                      <small>{column.scalarType}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 12).map((row) => (
                  <tr key={row.id}>
                    {data.columns.map((column) => (
                      <td key={column.id}>
                        {row.values[column.id] === null
                          ? "—"
                          : String(row.values[column.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <p className="analysis-note">
        Источник проверен. Анализ и сохранение отчёта появятся в следующем
        этапе.
      </p>
    </div>
  );
}
