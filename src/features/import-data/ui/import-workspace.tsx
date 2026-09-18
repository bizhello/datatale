"use client";

import { Button, Skeleton } from "@heroui/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useDropzone } from "react-dropzone";
import type { Dataset } from "@/entities/dataset";
import { normalizeTable, normalizeText } from "../model/normalize";
import { parseFileInWorker } from "../model/parse-file";
import { ImportError, type ImportResult } from "../model/types";

const demoTable = {
  headers: ["Месяц", "Выручка", "Заказы"],
  rows: [
    ["Январь", "128000", "120"],
    ["Февраль", "146000", "132"],
    ["Март", "171000", "156"],
    ["Апрель", "163000", "149"],
  ],
};
const demoText =
  "Месяц,Выручка,Заказы\nЯнварь,128000,120\nФевраль,146000,132\nМарт,171000,156\nАпрель,163000,149";

type ParserController = ReturnType<typeof parseFileInWorker>;
type ReadyState = {
  status: "ready";
  text: string;
  file?: File;
  result: ImportResult;
  selectedSheet?: string | undefined;
};
type ImportState =
  | { status: "empty"; text: string }
  | {
      status: "loading";
      text: string;
      file: File;
      requestId: number;
      selectingSheet?: string | undefined;
    }
  | ReadyState
  | {
      status: "error";
      text: string;
      file?: File;
      message: string;
      sheetNames?: string[] | undefined;
    };
type Action =
  | { type: "text"; text: string }
  | {
      type: "start";
      file: File;
      requestId: number;
      selectingSheet?: string | undefined;
    }
  | { type: "ready"; requestId?: number; state: ReadyState }
  | {
      type: "error";
      requestId: number;
      message: string;
      sheetNames?: string[] | undefined;
    }
  | { type: "file-error"; file: File; message: string }
  | { type: "local-error"; message: string }
  | { type: "empty" };

function reducer(state: ImportState, action: Action): ImportState {
  switch (action.type) {
    case "text":
      return { status: "empty", text: action.text };
    case "start":
      return {
        status: "loading",
        text: state.text,
        file: action.file,
        requestId: action.requestId,
        selectingSheet: action.selectingSheet,
      };
    case "ready":
      return action.requestId !== undefined &&
        state.status === "loading" &&
        state.requestId !== action.requestId
        ? state
        : action.state;
    case "error":
      return state.status === "loading" && state.requestId === action.requestId
        ? {
            status: "error",
            text: state.text,
            file: state.file,
            message: action.message,
            sheetNames: action.sheetNames,
          }
        : state;
    case "local-error":
      return { status: "error", text: state.text, message: action.message };
    case "file-error":
      return {
        status: "error",
        text: state.text,
        file: action.file,
        message: action.message,
      };
    case "empty":
      return { status: "empty", text: state.text };
  }
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
function isAbort(reason: unknown) {
  return reason instanceof DOMException && reason.name === "AbortError";
}
function isTextSource(
  source: ImportResult["source"],
): source is Extract<ImportResult["source"], { rawText: string }> {
  return "rawText" in source;
}

export function ImportWorkspace() {
  const [state, dispatch] = useReducer(reducer, { status: "empty", text: "" });
  const controllerRef = useRef<ParserController | undefined>(undefined);
  const requestIdRef = useRef(0);
  const cancelActive = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.cancel();
    controllerRef.current = undefined;
  }, []);
  useEffect(() => cancelActive, [cancelActive]);

  const settleFile = useCallback(
    (
      controller: ParserController,
      requestId: number,
      file: File,
      promise: Promise<ImportResult>,
    ) => {
      void promise.then(
        (result) => {
          if (
            requestIdRef.current !== requestId ||
            controllerRef.current !== controller
          )
            return;
          dispatch({
            type: "ready",
            requestId,
            state: {
              status: "ready",
              text: "",
              file,
              result,
              selectedSheet: !isTextSource(result.source)
                ? result.source.source.sheet
                : undefined,
            },
          });
        },
        (reason: unknown) => {
          if (requestIdRef.current !== requestId || isAbort(reason)) return;
          dispatch({
            type: "error",
            requestId,
            message: errorMessage(reason, "Не удалось обработать файл."),
            sheetNames:
              reason instanceof ImportError ? reason.sheetNames : undefined,
          });
        },
      );
    },
    [],
  );
  const acceptFile = useCallback(
    (file: File) => {
      cancelActive();
      const requestId = requestIdRef.current;
      let controller: ParserController;
      try {
        controller = parseFileInWorker(file);
      } catch (reason) {
        dispatch({
          type: "file-error",
          file,
          message: errorMessage(
            reason,
            "Не удалось запустить обработку файла в браузере.",
          ),
        });
        return;
      }
      controllerRef.current = controller;
      dispatch({ type: "start", file, requestId });
      settleFile(controller, requestId, file, controller.promise);
    },
    [cancelActive, settleFile],
  );
  const selectSheet = useCallback(
    (name: string) => {
      if (
        (state.status !== "ready" && state.status !== "error") ||
        !state.file ||
        !controllerRef.current
      )
        return;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = controllerRef.current;
      dispatch({
        type: "start",
        file: state.file,
        requestId,
        selectingSheet: name,
      });
      settleFile(
        controller,
        requestId,
        state.file,
        controller.selectSheet(name),
      );
    },
    [settleFile, state],
  );
  const acceptText = useCallback(() => {
    cancelActive();
    try {
      dispatch({
        type: "ready",
        state: {
          status: "ready",
          text: state.text,
          result: normalizeText(state.text),
        },
      });
    } catch (reason) {
      dispatch({
        type: "local-error",
        message: errorMessage(reason, "Не удалось принять текст."),
      });
    }
  }, [cancelActive, state.text]);
  const showDemo = useCallback(() => {
    cancelActive();
    dispatch({
      type: "ready",
      state: {
        status: "ready",
        text: demoText,
        result: normalizeTable(demoTable, {
          kind: "csv",
          filename: "demo.csv",
        }),
      },
    });
  }, [cancelActive]);
  const clear = useCallback(() => {
    cancelActive();
    dispatch({ type: "empty" });
  }, [cancelActive]);
  const retry = useCallback(() => {
    if (state.status === "error" && state.file) acceptFile(state.file);
  }, [acceptFile, state]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
    multiple: false,
    onDropAccepted: ([file]) => file && acceptFile(file),
    onDropRejected: () => {
      cancelActive();
      dispatch({
        type: "local-error",
        message:
          "Выберите один CSV или XLSX-файл размером до 2 МБ. XLS нужно сохранить как XLSX.",
      });
    },
  });
  const canEdit = state.status === "empty" || state.status === "error";
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
      {canEdit && (
        <div className="input-grid">
          <div
            {...getRootProps({
              className: `dropzone ${isDragActive ? "dropzone-active" : ""}`,
            })}
          >
            <input
              {...getInputProps()}
              aria-label="Выбрать CSV или XLSX файл"
            />
            <span className="input-icon">
              <Upload aria-hidden="true" />
            </span>
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
            <span className="input-icon">
              <FileText aria-hidden="true" />
            </span>
            <h2>Или вставьте текст</h2>
            <label htmlFor="source-text">Текст отчёта</label>
            <textarea
              id="source-text"
              value={state.text}
              onChange={(event) => {
                cancelActive();
                dispatch({ type: "text", text: event.target.value });
              }}
              placeholder="Вставьте короткий отчёт или заметки…"
            />
            <div>
              <span>{state.text.length.toLocaleString("ru-RU")} / 30 000</span>
              <Button variant="secondary" onPress={acceptText}>
                Проверить текст
              </Button>
            </div>
          </div>
        </div>
      )}
      {canEdit && (
        <Button className="demo-button" variant="ghost" onPress={showDemo}>
          Загрузить синтетический демо-набор
        </Button>
      )}
      {state.status === "loading" && (
        <LoadingState onCancel={clear} sheet={state.selectingSheet} />
      )}
      {state.status === "error" && (
        <ErrorState
          message={state.message}
          onRetry={retry}
          onClear={clear}
          retryable={Boolean(state.file)}
          sheetNames={state.sheetNames}
          onSheet={selectSheet}
        />
      )}
      {state.status === "ready" && (
        <Preview state={state} onSheet={selectSheet} onClear={clear} />
      )}
    </section>
  );
}

function LoadingState({
  onCancel,
  sheet,
}: {
  onCancel: () => void;
  sheet?: string | undefined;
}) {
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
function ErrorState({
  message,
  onRetry,
  onClear,
  retryable,
  sheetNames,
  onSheet,
}: {
  message: string;
  onRetry: () => void;
  onClear: () => void;
  retryable: boolean;
  sheetNames?: string[] | undefined;
  onSheet: (value: string) => void;
}) {
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
function Preview({
  state,
  onSheet,
  onClear,
}: {
  state: ReadyState;
  onSheet: (value: string) => void;
  onClear: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const text = isTextSource(state.result.source)
    ? state.result.source
    : undefined;
  const data = text ? undefined : (state.result.source as Dataset);
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
function TablePreview({ data }: { data: Dataset }) {
  const sample = data.rows.slice(0, 12);
  return (
    <div className="table-wrap">
      <p className="sample-label">
        Показаны первые {sample.length} строк из{" "}
        {data.rows.length.toLocaleString("ru-RU")}
      </p>
      <table>
        <thead>
          <tr>
            {data.columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
                <small>{column.scalarType}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sample.map((row) => (
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
  );
}
