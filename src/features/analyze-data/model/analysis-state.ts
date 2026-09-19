import type { FinalReport } from "@/entities/report";

export type AnalysisErrorCode =
  | "unavailable"
  | "quota"
  | "configuration"
  | "provider"
  | "timeout"
  | "invalid-report"
  | "duplicate"
  | "network"
  | "unknown";

export type AnalysisState =
  | { status: "idle" }
  | {
      status: "analyzing";
      requestId: number;
      idempotencyKey: string;
      stage: string;
    }
  | { status: "ready"; report: FinalReport }
  | { status: "cancelled" }
  | { status: "error"; error: AnalysisErrorCode; retryKey?: string };

export type AnalysisAction =
  | { type: "start"; requestId: number; idempotencyKey: string }
  | { type: "ready"; requestId: number; report: FinalReport }
  | {
      type: "error";
      requestId: number;
      error: AnalysisErrorCode;
      retryKey?: string;
    }
  | { type: "cancel"; requestId: number }
  | { type: "reset" };

export const initialAnalysisState: AnalysisState = { status: "idle" };

export function analysisReducer(
  state: AnalysisState,
  action: AnalysisAction,
): AnalysisState {
  if (action.type === "reset") return initialAnalysisState;
  if (action.type === "start")
    return {
      status: "analyzing",
      requestId: action.requestId,
      idempotencyKey: action.idempotencyKey,
      stage: "Проверяем источник и готовим расчёты…",
    };
  if (state.status !== "analyzing" || state.requestId !== action.requestId)
    return state;
  if (action.type === "ready")
    return { status: "ready", report: action.report };
  if (action.type === "cancel") return { status: "cancelled" };
  return {
    status: "error",
    error: action.error,
    ...(action.retryKey ? { retryKey: action.retryKey } : {}),
  };
}

export const analysisErrorMessages: Record<AnalysisErrorCode, string> = {
  unavailable: "Анализ пока недоступен: сервис не настроен.",
  quota: "Лимит анализов на сегодня исчерпан. Попробуйте позже.",
  configuration: "Настройки AI-провайдера требуют проверки.",
  provider: "AI-провайдер не ответил корректно. Повторите попытку.",
  timeout: "Анализ занял слишком много времени. Повторите попытку.",
  "invalid-report": "Провайдер вернул неполный отчёт. Данные не показаны.",
  duplicate: "Этот анализ уже выполняется. Подождите или попробуйте позже.",
  network: "Не удалось подключиться к сервису анализа. Проверьте сеть.",
  unknown: "Не удалось выполнить анализ. Повторите попытку.",
};
