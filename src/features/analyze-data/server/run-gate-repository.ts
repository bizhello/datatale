import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/shared/lib/db";
import type {
  ClaimInput,
  RunGateConfig,
  RunGateOutcome,
  RunGateRepository,
} from "./run-gate";

type Sql = ReturnType<typeof getDatabase>;
/** The migration's claim_analysis_run function performs every claim decision atomically. */
export class SqlRunGateRepository<Report = unknown>
  implements RunGateRepository<Report>
{
  constructor(private readonly sql: Sql = getDatabase()) {}
  private client() {
    if (!this.sql) throw new Error("Database unavailable");
    return this.sql;
  }
  async claim(
    input: ClaimInput,
    config: Required<RunGateConfig>,
  ): Promise<RunGateOutcome<Report>> {
    const now = input.now ?? new Date();
    const rows =
      await this.client()`SELECT * FROM claim_analysis_run(${randomUUID()}, ${input.workspaceId}, ${input.key}, ${input.fingerprint}, ${input.ipHash}, ${input.codeFingerprint ?? null}, ${now}, ${config.workspaceDailyLimit}, ${config.ipDailyLimit}, ${config.codeDailyLimit}, ${config.globalDailyLimit}, ${config.receiptTtlMs}, ${config.leaseMs}, ${config.quotaTtlMs})`;
    const result = rows[0] as
      | {
          kind: string;
          receipt_id: string | null;
          report: Report | null;
          quota_scope: "workspace" | "ip" | "code" | "global" | null;
        }
      | undefined;
    if (!result || result.kind === "unavailable")
      return { kind: "unavailable" };
    if (result.kind === "claimed" && result.receipt_id)
      return { kind: "claimed", receiptId: result.receipt_id };
    if (result.kind === "replay" && result.report !== null)
      return { kind: "replay", report: result.report };
    if (result.kind === "quota" && result.quota_scope)
      return { kind: "quota", scope: result.quota_scope };
    if (
      result.kind === "conflict" ||
      result.kind === "in-flight" ||
      result.kind === "provider-started"
    )
      return { kind: result.kind };
    return { kind: "unavailable" };
  }
  async markProviderStarted(workspaceId: string, receiptId: string, now: Date) {
    const rows =
      await this.client()`UPDATE analysis_runs SET state = 'provider_started', provider_started_at = ${now} WHERE id = ${receiptId} AND workspace_id = ${workspaceId} AND state = 'claimed' AND expires_at > ${now} RETURNING id`;
    return rows.length === 1;
  }
  async succeed(
    workspaceId: string,
    receiptId: string,
    report: Report,
    now: Date,
  ) {
    const rows =
      await this.client()`UPDATE analysis_runs SET state = 'succeeded', report = ${JSON.stringify(report)}::jsonb WHERE id = ${receiptId} AND workspace_id = ${workspaceId} AND state = 'provider_started' AND expires_at > ${now} RETURNING id`;
    return rows.length === 1;
  }
  async fail(
    workspaceId: string,
    receiptId: string,
    providerSpent: boolean,
    code: string,
    now: Date,
  ) {
    const rows =
      await this.client()`UPDATE analysis_runs SET state = 'failed', provider_started_at = CASE WHEN ${providerSpent} THEN COALESCE(provider_started_at, ${now}) ELSE NULL END, failure_code = ${code} WHERE id = ${receiptId} AND workspace_id = ${workspaceId} AND state IN ('claimed', 'provider_started') AND expires_at > ${now} RETURNING id`;
    return rows.length === 1;
  }
  async cleanup(now: Date) {
    const sql = this.client();
    const rows = await sql.transaction([
      sql`DELETE FROM analysis_runs WHERE expires_at <= ${now} RETURNING id`,
      sql`DELETE FROM guest_workspaces WHERE expires_at <= ${now} OR revoked_at IS NOT NULL RETURNING id`,
      sql`DELETE FROM analysis_quota_buckets WHERE expires_at <= ${now} RETURNING scope`,
    ]);
    return rows.reduce((sum, values) => sum + values.length, 0);
  }
  async deleteWorkspace(workspaceId: string) {
    const sql = this.client();
    const rows = await sql.transaction([
      sql`DELETE FROM analysis_runs WHERE workspace_id = ${workspaceId} RETURNING id`,
      sql`DELETE FROM guest_workspaces WHERE id = ${workspaceId} RETURNING id`,
    ]);
    return (rows[1]?.length ?? 0) === 1;
  }
}
