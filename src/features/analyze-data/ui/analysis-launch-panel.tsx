"use client";
import { Button, Description, Label, TextArea, TextField } from "@heroui/react";
import { useState } from "react";
import {
  ANALYSIS_FOCUS_MAX_LENGTH,
  normalizeAnalysisFocus,
} from "../model/analysis-focus";

type AnalysisLaunchPanelProps = {
  onLaunch: (focus?: string) => void;
};

export function AnalysisLaunchPanel({ onLaunch }: AnalysisLaunchPanelProps) {
  const [focus, setFocus] = useState("");
  return (
    <div className="analysis-launch-panel">
      <p className="analysis-note">
        Полный проверенный источник будет передан AI-провайдеру. Его правила
        хранения действуют отдельно. Принятые данные, отчёт и чат хранятся в
        этом гостевом пространстве 7 дней с момента анализа; просмотр не
        продлевает срок. Исходный CSV или XLSX файл не сохраняется, а счётчики
        безопасности удаляются не позднее чем через 48 часов.
      </p>
      <TextField>
        <Label>Что вы хотите понять? (необязательно)</Label>
        <TextArea
          value={focus}
          maxLength={ANALYSIS_FOCUS_MAX_LENGTH}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="Например: сравните продажи по регионам и найдите просадки"
        />
        <Description>
          Можно оставить поле пустым для общего обзора. До 400 символов.
        </Description>
      </TextField>
      <Button onPress={() => onLaunch(normalizeAnalysisFocus(focus))}>
        Запустить AI-анализ
      </Button>
    </div>
  );
}
