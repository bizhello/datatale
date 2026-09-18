"use client";

import { Button } from "@heroui/react";
import { useImportWorkspace } from "../model/use-import-workspace";
import { ErrorState } from "./error-state";
import { InputOptions } from "./input-options";
import { LoadingState } from "./loading-state";
import { SourcePreview } from "./source-preview";

export function ImportWorkspace() {
  const {
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
  } = useImportWorkspace();
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
      {canEdit && (
        <InputOptions
          text={state.text}
          onAcceptFile={acceptFile}
          onRejectFile={rejectFile}
          onChangeText={changeText}
          onAcceptText={acceptText}
        />
      )}
      {canEdit && (
        <Button className="demo-button" variant="ghost" onPress={showDemo}>
          Загрузить синтетический демо-набор
        </Button>
      )}
      {state.status === "loading" && (
        <LoadingState onCancel={cancel} sheet={state.selectingSheet} />
      )}
      {state.status === "ready" && (
        <SourcePreview state={state} onSheet={selectSheet} onClear={clear} />
      )}
    </section>
  );
}
