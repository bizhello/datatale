import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/shared/lib/db";
import {
  type AcceptedSource,
  assertStoragePayloads,
  SAVED_ANALYSIS_HISTORY_MAX_MESSAGES,
  SAVED_ANALYSIS_TTL_MS,
  type SavedAnalysis,
  type SavedAnalysisMessage,
  type SavedAnalysisValidators,
  type SavedMessageInput,
  savedAnalysisMessageSchema,
  savedAnalysisSchema,
  savedMessageInputSchema,
  sourceKind,
} from "../model/schema";

type Sql = ReturnType<typeof getDatabase>;

export type SavedAnalysisRepository = Readonly<{
  create(input: {
    workspaceId: string;
    source: AcceptedSource;
    report: unknown;
    now?: Date;
    analysisId?: string;
  }): Promise<SavedAnalysis | undefined>;
  get(
    workspaceId: string,
    analysisId: string,
    now?: Date,
  ): Promise<SavedAnalysis | undefined>;
  list(workspaceId: string, now?: Date): Promise<ReadonlyArray<SavedAnalysis>>;
  appendMessage(input: {
    workspaceId: string;
    analysisId: string;
    message: SavedMessageInput;
    dailyLimit: number;
    now?: Date;
  }): Promise<SavedAnalysisMessage | "quota-exceeded" | undefined>;
  messages(input: {
    workspaceId: string;
    analysisId: string;
    limit?: number;
    now?: Date;
  }): Promise<ReadonlyArray<SavedAnalysisMessage>>;
}>;

function parseAnalysis(row: unknown): SavedAnalysis | undefined {
  const result = savedAnalysisSchema.safeParse(row);
  return result.success ? result.data : undefined;
}

function parseMessage(row: unknown): SavedAnalysisMessage | undefined {
  const result = savedAnalysisMessageSchema.safeParse(row);
  return result.success ? result.data : undefined;
}

function assertId(value: string, label: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error(`${label} must be an opaque UUID.`);
}

export class SqlSavedAnalysisRepository implements SavedAnalysisRepository {
  constructor(
    private readonly validators: SavedAnalysisValidators,
    private readonly sql: Sql = getDatabase(),
  ) {}
  private client() {
    if (!this.sql) throw new Error("Database unavailable");
    return this.sql;
  }

  async create(input: {
    workspaceId: string;
    source: AcceptedSource;
    report: unknown;
    now?: Date;
    analysisId?: string;
  }) {
    assertId(input.workspaceId, "Workspace ID");
    const payload = assertStoragePayloads(
      input.source,
      input.report,
      this.validators,
    );
    const now = input.now ?? new Date();
    const id = input.analysisId ?? randomUUID();
    assertId(id, "Analysis ID");
    const expiresAt = new Date(now.getTime() + SAVED_ANALYSIS_TTL_MS);
    const rows = await this.client()`
      INSERT INTO saved_analyses (id, workspace_id, source_kind, source, report, created_at, last_accessed_at, expires_at)
      SELECT ${id}, ${input.workspaceId}, ${sourceKind(payload.source)}, ${JSON.stringify(payload.source)}::jsonb, ${JSON.stringify(payload.report)}::jsonb, ${now}, ${now}, ${expiresAt}
      FROM guest_workspaces
      WHERE id = ${input.workspaceId} AND revoked_at IS NULL AND expires_at > ${now}
      ON CONFLICT (id) DO NOTHING
      RETURNING id, workspace_id AS "workspaceId", source, report, created_at AS "createdAt", last_accessed_at AS "lastAccessedAt", expires_at AS "expiresAt"
    `;
    if (rows.length === 0) {
      const existing = await this.get(input.workspaceId, id, now);
      if (!existing) return undefined;
      const samePayload = await this.client()`
        SELECT id FROM saved_analyses
        WHERE id = ${id} AND workspace_id = ${input.workspaceId}
          AND source = ${JSON.stringify(payload.source)}::jsonb
          AND report = ${JSON.stringify(payload.report)}::jsonb
        LIMIT 1
      `;
      if (samePayload.length === 0)
        throw new Error(
          "Saved analysis already exists with different immutable payloads.",
        );
      return existing;
    }
    return parseAnalysis(rows[0]);
  }

  async get(workspaceId: string, analysisId: string, now = new Date()) {
    const rows = await this.client()`
      UPDATE saved_analyses a SET last_accessed_at = ${now}, expires_at = ${new Date(now.getTime() + SAVED_ANALYSIS_TTL_MS)}
      FROM guest_workspaces w
      WHERE a.id = ${analysisId} AND a.workspace_id = ${workspaceId} AND w.id = a.workspace_id
        AND w.revoked_at IS NULL AND w.expires_at > ${now} AND a.expires_at > ${now}
      RETURNING a.id, a.workspace_id AS "workspaceId", a.source, a.report, a.created_at AS "createdAt", a.last_accessed_at AS "lastAccessedAt", a.expires_at AS "expiresAt"
    `;
    return parseAnalysis(rows[0]);
  }

  async list(workspaceId: string, now = new Date()) {
    const rows = await this.client()`
      SELECT a.id, a.workspace_id AS "workspaceId", a.source, a.report, a.created_at AS "createdAt", a.last_accessed_at AS "lastAccessedAt", a.expires_at AS "expiresAt"
      FROM saved_analyses a JOIN guest_workspaces w ON w.id = a.workspace_id
      WHERE a.workspace_id = ${workspaceId} AND w.revoked_at IS NULL AND w.expires_at > ${now} AND a.expires_at > ${now}
      ORDER BY a.created_at ASC, a.id ASC
    `;
    return rows.flatMap((row) => {
      const parsed = parseAnalysis(row);
      return parsed ? [parsed] : [];
    });
  }

  async appendMessage(input: {
    workspaceId: string;
    analysisId: string;
    message: SavedMessageInput;
    dailyLimit: number;
    now?: Date;
  }) {
    const message = savedMessageInputSchema.parse(input.message);
    if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1)
      throw new Error("Chat daily limit must be positive.");
    const now = input.now ?? new Date();
    const bucket = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const rows = await this.client()`
      WITH active AS (
        SELECT a.id FROM saved_analyses a JOIN guest_workspaces w ON w.id = a.workspace_id
        WHERE a.id = ${input.analysisId} AND a.workspace_id = ${input.workspaceId}
          AND w.revoked_at IS NULL AND w.expires_at > ${now} AND a.expires_at > ${now}
        FOR UPDATE
      ), existing AS (
        SELECT m.sequence, m.analysis_id, m.message_id, m.role, m.content, m.created_at
        FROM saved_analysis_messages m JOIN active a ON a.id = m.analysis_id
        WHERE m.message_id = ${message.id}
      ), bucket_insert AS (
        INSERT INTO analysis_quota_buckets (scope, bucket_start, count, expires_at)
        SELECT 'chat:' || ${input.workspaceId}, ${bucket}, 0, ${new Date(now.getTime() + 48 * 60 * 60_000)}
        WHERE EXISTS (SELECT 1 FROM active) AND NOT EXISTS (SELECT 1 FROM existing) AND ${message.role} = 'user'
        ON CONFLICT (scope, bucket_start) DO NOTHING
      ), charged AS (
        UPDATE analysis_quota_buckets b SET count = b.count + 1, expires_at = ${new Date(now.getTime() + 48 * 60 * 60_000)}
        WHERE b.scope = 'chat:' || ${input.workspaceId} AND b.bucket_start = ${bucket} AND b.count < ${input.dailyLimit}
          AND NOT EXISTS (SELECT 1 FROM existing) AND ${message.role} = 'user'
        RETURNING b.scope
      ), inserted AS (
        INSERT INTO saved_analysis_messages (analysis_id, message_id, role, content, created_at)
        SELECT ${input.analysisId}, ${message.id}, ${message.role}, ${message.content}, ${now}
        WHERE EXISTS (SELECT 1 FROM active) AND NOT EXISTS (SELECT 1 FROM existing)
          AND (${message.role} = 'assistant' OR EXISTS (SELECT 1 FROM charged))
        RETURNING sequence, analysis_id, message_id, role, content, created_at
      )
      SELECT sequence, analysis_id, message_id, role, content, created_at, false AS "quotaExceeded", false AS "messageConflict" FROM inserted
      UNION ALL
      SELECT sequence, analysis_id, message_id, role, content, created_at, false AS "quotaExceeded", (role <> ${message.role} OR content <> ${message.content}) AS "messageConflict" FROM existing
      UNION ALL
      SELECT NULL::bigint, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::timestamptz, true AS "quotaExceeded", false AS "messageConflict"
      WHERE EXISTS (SELECT 1 FROM active) AND NOT EXISTS (SELECT 1 FROM existing) AND NOT EXISTS (SELECT 1 FROM inserted)
    `;
    const row = rows[0] as
      | {
          quotaExceeded?: boolean;
          message_id?: string;
          analysis_id?: string;
          role?: string;
          content?: string;
          created_at?: Date;
          messageConflict?: boolean;
        }
      | undefined;
    if (!row) return undefined;
    if (row.quotaExceeded) return "quota-exceeded" as const;
    if (row.messageConflict)
      throw new Error("Message ID already exists with different content.");
    const parsed = parseMessage({
      id: row.message_id,
      analysisId: row.analysis_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    });
    return parsed;
  }

  async messages(input: {
    workspaceId: string;
    analysisId: string;
    limit?: number;
    now?: Date;
  }) {
    const limit = Math.min(
      Math.max(
        Math.trunc(input.limit ?? SAVED_ANALYSIS_HISTORY_MAX_MESSAGES),
        1,
      ),
      SAVED_ANALYSIS_HISTORY_MAX_MESSAGES,
    );
    const now = input.now ?? new Date();
    const rows = await this.client()`
      SELECT m.message_id AS id, m.analysis_id AS "analysisId", m.role, m.content, m.created_at AS "createdAt"
      FROM saved_analysis_messages m JOIN saved_analyses a ON a.id = m.analysis_id JOIN guest_workspaces w ON w.id = a.workspace_id
      WHERE m.analysis_id = ${input.analysisId} AND a.workspace_id = ${input.workspaceId}
        AND w.revoked_at IS NULL AND w.expires_at > ${now} AND a.expires_at > ${now}
      ORDER BY m.sequence DESC LIMIT ${limit}
    `;
    return rows
      .flatMap((row) => {
        const parsed = parseMessage(row);
        return parsed ? [parsed] : [];
      })
      .reverse();
  }
}
