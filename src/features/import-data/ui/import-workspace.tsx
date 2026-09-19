"use client";

import { Button } from "@heroui/react";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { Dataset, TextSource } from "@/entities/dataset";
import { useImportWorkspace } from "../model/use-import-workspace";
import { EmptyResultExplanation } from "./empty-result-explanation";
import { ErrorState } from "./error-state";
import { InputOptions } from "./input-options";
import { LoadingState } from "./loading-state";
import { SourcePreview } from "./source-preview";

type ImportWorkspaceProps = {
  renderReadyAction?: (source: Dataset | TextSource) => ReactNode;
};

export function ImportWorkspace({ renderReadyAction }: ImportWorkspaceProps) {
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
      <div
        className={`import-hero-grid${state.status === "empty" ? "" : " import-hero-grid-single"}`}
      >
        <div className="section-heading">
          <p className="eyebrow">ИСТОЧНИК ДАННЫХ</p>
          <h1 id="input-title">Начните с того, что у вас уже есть.</h1>
          <p>
            Файлы сначала обрабатываются в этом браузере. После проверки вы сами
            запускаете AI-анализ.
          </p>
        </div>
        {state.status === "empty" && <EmptyResultExplanation />}
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
          variant="secondary"
          onPress={showDemo}
        >
          <Sparkles aria-hidden="true" />
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
          {...(renderReadyAction ? { renderAction: renderReadyAction } : {})}
        />
      )}
    </section>
  );
}
