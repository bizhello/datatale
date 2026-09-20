export const MAX_QUESTION_LENGTH = 500;

export type AskDataAnswer = {
  status: "answered";
  answer: string;
  evidenceLabels?: string[];
};

export type AskDataResult =
  | AskDataAnswer
  | { status: "clarification"; message: string }
  | { status: "not_in_source"; message: string }
  | { status: "unsupported_operation"; message: string };

export type AskDataSend = (
  request: { messageId: string; question: string },
  signal: AbortSignal,
) => Promise<AskDataResult>;

export type AskDataMessage = {
  id: string;
  messageId?: string;
  role: "user" | "assistant";
  text: string;
  evidenceLabels?: string[];
  kind?: "answer" | "clarification" | "not_in_source" | "unsupported" | "error";
};

export class AskDataClientError extends Error {
  readonly retryable: boolean;
  readonly code: string | undefined;
  readonly quotaScope: "workspace" | "unlocked-workspace" | undefined;

  constructor(
    message: string,
    options: {
      code?: string;
      retryable?: boolean;
      quotaScope?: "workspace" | "unlocked-workspace";
    } = {},
  ) {
    super(message);
    this.name = "AskDataClientError";
    this.retryable = options.retryable ?? true;
    this.code = options.code;
    this.quotaScope = options.quotaScope;
  }
}
