"use client";

import { Button } from "@heroui/react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { useImportWorkspace } from "../model/use-import-workspace";
import { ErrorState } from "./error-state";
import { InputOptions } from "./input-options";
import { LiquidResultPreview } from "./liquid-result-preview";
import { LoadingState } from "./loading-state";
import { SourcePreview } from "./source-preview";

type ImportWorkspaceProps = {
  onReady?: (source: Dataset | TextSource) => void;
};

export function ImportWorkspace({ onReady }: ImportWorkspaceProps) {
  const {
    state,
    acceptText,
    cancel,
    changeText,
    clear,
    retry,
    selectSheet,
    showDemo,
    dropzone,
  } = useImportWorkspace();
  const canEdit = state.status === "empty" || state.status === "error";
  return (
    <section
      className="import-workspace"
      aria-labelledby="input-title"
      id="onboarding-source"
    >
      <div className="import-hero-grid">
        <div className="section-heading">
          <p className="eyebrow">ИСТОЧНИК ДАННЫХ</p>
          <h1 id="input-title">Начните с того, что у вас уже есть.</h1>
          <p>
            Файлы сначала обрабатываются в этом браузере. После проверки вы сами
            запускаете AI-анализ.
          </p>
        </div>
        <LiquidResultPreview />
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
          onChangeText={changeText}
          onAcceptText={acceptText}
          dropzone={dropzone}
        />
      )}
      {canEdit && (
        <Button
          className="demo-button"
          id="onboarding-demo"
          variant="ghost"
          onPress={showDemo}
        >
          Загрузить синтетический демо-набор
        </Button>
      )}
      {state.status === "loading" && (
        <LoadingState onCancel={cancel} sheet={state.selectingSheet} />
      )}
      {state.status === "ready" && (
        <SourcePreview
          state={state}
          onSheet={selectSheet}
          onClear={clear}
          {...(onReady ? { onAnalyze: onReady } : {})}
        />
      )}
    </section>
  );
}
