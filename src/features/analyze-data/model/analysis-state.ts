import type { FinalReport } from "@/entities/report";

export type AnalysisErrorCode =
  | "unavailable"
  | "quota"
  | "configuration"
  | "provider"
  | "timeout"
  | "invalid-report"
  | "conflict"
  | "in-flight"
  | "indeterminate"
  | "expired"
  | "invalid-source"
  | "network"
  | "unknown";
export type QuotaScope = "workspace" | "ip" | "code" | "global";

export type AnalysisPhase = "session-setup" | "processing";

export type AnalysisState =
  | { status: "idle" }
  | {
      status: "analyzing";
      requestId: number;
      idempotencyKey: string;
      phase: AnalysisPhase;
      progress: number;
    }
  | {
      status: "completing";
      requestId: number;
      report: FinalReport;
      phase: AnalysisPhase;
      progress: 100;
    }
  | { status: "ready"; report: FinalReport }
  | { status: "cancelled" }
  | {
      status: "error";
      error: AnalysisErrorCode;
      retryable: boolean;
      retryKey?: string;
      quotaScope?: QuotaScope;
    };

export type AnalysisAction =
  | { type: "start"; requestId: number; idempotencyKey: string }
  | { type: "session-setup-complete"; requestId: number }
  | { type: "progress"; requestId: number; value: number }
  | { type: "complete"; requestId: number; report: FinalReport }
  | { type: "ready"; requestId: number; report: FinalReport }
  | {
      type: "error";
      requestId: number;
      error: AnalysisErrorCode;
      retryable: boolean;
      retryKey?: string;
      quotaScope?: QuotaScope;
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
      phase: "session-setup",
      progress: 0,
    };
  if (
    (state.status !== "analyzing" && state.status !== "completing") ||
    state.requestId !== action.requestId
  )
    return state;
  if (action.type === "session-setup-complete")
    return { ...state, phase: "processing" };
  if (state.status === "analyzing" && action.type === "progress")
    return {
      ...state,
      progress: Math.min(95, Math.max(state.progress, action.value)),
    };
  if (state.status === "analyzing" && action.type === "complete")
    return {
      status: "completing",
      requestId: action.requestId,
      report: action.report,
      phase: state.phase,
      progress: 100,
    };
  if (state.status === "completing" && action.type === "cancel")
    return { status: "cancelled" };
  if (state.status === "completing" && action.type === "ready")
    return { status: "ready", report: action.report };
  if (state.status !== "analyzing") return state;
  if (action.type === "ready")
    return { status: "ready", report: action.report };
  if (action.type === "cancel") return { status: "cancelled" };
  if (action.type !== "error") return state;
  return {
    status: "error",
    error: action.error,
    retryable: action.retryable,
    ...(action.retryKey ? { retryKey: action.retryKey } : {}),
    ...(action.quotaScope ? { quotaScope: action.quotaScope } : {}),
  };
}

export const analysisErrorMessages: Record<AnalysisErrorCode, string> = {
  unavailable: "Анализ пока недоступен: сервис не настроен.",
  quota: "Лимит анализов на сегодня исчерпан. Попробуйте позже.",
  configuration: "Настройки AI-провайдера требуют проверки.",
  provider: "AI-провайдер не ответил корректно. Повторите попытку.",
  timeout:
    "Анализ занял слишком много времени, поэтому результат не подтверждён. Автоматический повтор отключён.",
  "invalid-report": "Провайдер вернул неполный отчёт. Данные не показаны.",
  conflict: "Ключ запроса уже использован для другого источника.",
  "in-flight":
    "Этот анализ ещё выполняется. Попробуйте проверить результат позже.",
  indeterminate:
    "Провайдер уже начал анализ, но результат не подтверждён. Автоматический повтор отключён, чтобы не списать лимит дважды.",
  expired: "Гостевой сеанс истёк. Запустите анализ ещё раз.",
  "invalid-source": "Источник не прошёл серверную проверку.",
  network: "Не удалось подключиться к сервису анализа. Проверьте сеть.",
  unknown: "Не удалось выполнить анализ. Повторите попытку.",
};
