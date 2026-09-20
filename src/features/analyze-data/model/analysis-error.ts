import { workspaceDailyQuota } from "@/shared/config";
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
  if (scope === "unlocked-workspace")
    return `Лимит в ${workspaceDailyQuota.unlocked} анализов на сегодня исчерпан.`;
  if (scope === "global") return "Общий лимит анализов на сегодня исчерпан.";
  if (canUnlockAnalysis(error, scope))
    return `Лимит в ${workspaceDailyQuota.free} бесплатных анализов на сегодня исчерпан. Введите код доступа, чтобы увеличить лимит до ${workspaceDailyQuota.unlocked}.`;
  return analysisErrorMessages.quota;
}
