import {
  type AnalysisErrorCode,
  analysisErrorMessages,
  type QuotaScope,
} from "./analysis-state";

export function canUnlockAnalysis(
  error: AnalysisErrorCode,
  scope?: QuotaScope,
) {
  return error === "quota" && (scope === "workspace" || scope === "ip");
}

export function errorMessage(
  error: keyof typeof analysisErrorMessages,
  scope?: QuotaScope,
) {
  if (error !== "quota") return analysisErrorMessages[error];
  if (scope === "code")
    return "Лимит этого кода приглашения на сегодня исчерпан.";
  if (scope === "global") return "Общий лимит анализов на сегодня исчерпан.";
  if (canUnlockAnalysis(error, scope))
    return "Бесплатный анализ на сегодня использован. Продолжите с кодом приглашения.";
  return analysisErrorMessages.quota;
}
