import { useCallback, useEffect, useReducer, useRef } from "react";
import { demoTable, demoText } from "../config/import-workspace";
import { ImportError } from "../lib/import-error";
import { errorMessage, isAbort } from "../lib/import-errors";
import { isTextSource } from "../lib/source-guards";
import { importWorkspaceReducer } from "./import-workspace-reducer";
import type { ParserController } from "./import-workspace-state";
import { normalizeTable, normalizeText } from "./normalize";
import { parseFileInWorker } from "./parse-file";
import type { ImportResult } from "./types";

export function useImportWorkspace() {
  const [state, dispatch] = useReducer(importWorkspaceReducer, {
    status: "empty",
    text: "",
  });
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
        isDemo: true,
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
  const cancel = useCallback(() => {
    cancelActive();
    dispatch({ type: "cancel" });
  }, [cancelActive]);
  const retry = useCallback(() => {
    if (state.status === "error" && state.file) acceptFile(state.file);
  }, [acceptFile, state]);
  const changeText = useCallback(
    (text: string) => {
      cancelActive();
      dispatch({ type: "text", text });
    },
    [cancelActive],
  );
  const rejectFile = useCallback(() => {
    cancelActive();
    dispatch({
      type: "local-error",
      message:
        "Выберите один CSV или XLSX-файл размером до 2 МБ. XLS нужно сохранить как XLSX.",
    });
  }, [cancelActive]);

  return {
    state,
    acceptFile,
    acceptText,
    cancel,
    changeText,
    clear,
    rejectFile,
    retry,
    selectSheet,
    showDemo,
  };
}
