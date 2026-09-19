import { analysisErrorMessages, type QuotaScope } from "./analysis-state";

export function errorMessage(
  error: keyof typeof analysisErrorMessages,
  scope?: QuotaScope,
) {
  if (error !== "quota") return analysisErrorMessages[error];
  if (scope === "code")
    return "Лимит этого кода приглашения на сегодня исчерпан.";
  if (scope === "global") return "Общий лимит анализов на сегодня исчерпан.";
  return analysisErrorMessages.quota;
}
