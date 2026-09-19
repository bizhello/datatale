export type ReceiptState =
  | "claimed"
  | "provider_started"
  | "succeeded"
  | "failed";
export type RunGateOutcome<Report = unknown> =
  | { kind: "claimed"; receiptId: string }
  | { kind: "replay"; report: Report }
  | { kind: "in-flight" }
  | { kind: "provider-started" }
  | { kind: "conflict" }
  | { kind: "quota"; scope: "workspace" | "ip" | "code" | "global" }
  | { kind: "unavailable" }
  | { kind: "expired" };

export type RunGateConfig = Readonly<{
  workspaceDailyLimit: number;
  ipDailyLimit: number;
  globalDailyLimit: number;
  codeDailyLimit?: number;
  receiptTtlMs?: number;
  leaseMs?: number;
  quotaTtlMs?: number;
}>;
export type ClaimInput = Readonly<{
  workspaceId: string;
  ipHash: string;
  key: string;
  fingerprint: string;
  codeFingerprint?: string;
  now?: Date;
}>;
export type RunReceipt<Report = unknown> = Readonly<{
  id: string;
  workspaceId: string;
  key: string;
  fingerprint: string;
  state: ReceiptState;
  leaseExpiresAt: Date;
  expiresAt: Date;
  providerStartedAt?: Date;
  report?: Report;
  failureCode?: string;
}>;
export interface RunGateRepository<Report = unknown> {
  claim(
    input: ClaimInput,
    config: Required<RunGateConfig>,
  ): Promise<RunGateOutcome<Report>>;
  markProviderStarted(
    workspaceId: string,
    receiptId: string,
    now: Date,
  ): Promise<boolean>;
  succeed(
    workspaceId: string,
    receiptId: string,
    report: Report,
    now: Date,
  ): Promise<boolean>;
  fail(
    workspaceId: string,
    receiptId: string,
    providerSpent: boolean,
    code: string,
    now: Date,
  ): Promise<boolean>;
  cleanup(now: Date): Promise<number>;
  deleteWorkspace(workspaceId: string): Promise<boolean>;
}
const defaults = {
  receiptTtlMs: 15 * 60_000,
  leaseMs: 90_000,
  quotaTtlMs: 48 * 60 * 60_000,
} as const;
function validConfig(config: RunGateConfig): config is Required<RunGateConfig> {
  return (
    [
      config.workspaceDailyLimit,
      config.ipDailyLimit,
      config.globalDailyLimit,
    ].every((value) => Number.isInteger(value) && value > 0) &&
    Number.isInteger(config.codeDailyLimit) &&
    (config.codeDailyLimit ?? 0) > 0
  );
}
export class RunGate<Report = unknown> {
  constructor(
    private readonly repository: RunGateRepository<Report>,
    private readonly config: RunGateConfig,
  ) {}
  claim(input: ClaimInput) {
    const config = { ...defaults, ...this.config };
    return validConfig(config)
      ? this.repository.claim(input, config)
      : Promise.resolve({ kind: "unavailable" } as const);
  }
  markProviderStarted(
    workspaceId: string,
    receiptId: string,
    now = new Date(),
  ) {
    return this.repository.markProviderStarted(workspaceId, receiptId, now);
  }
  succeed(
    workspaceId: string,
    receiptId: string,
    report: Report,
    now = new Date(),
  ) {
    return this.repository.succeed(workspaceId, receiptId, report, now);
  }
  fail(
    workspaceId: string,
    receiptId: string,
    providerSpent: boolean,
    code: string,
    now = new Date(),
  ) {
    return this.repository.fail(
      workspaceId,
      receiptId,
      providerSpent,
      code,
      now,
    );
  }
}
