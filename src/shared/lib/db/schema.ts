import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const guestWorkspaces = pgTable("guest_workspaces", {
  id: uuid("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => guestWorkspaces.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    state: text("state").notNull(),
    providerStartedAt: timestamp("provider_started_at", {
      withTimezone: true,
    }),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    report: jsonb("report"),
    failureCode: text("failure_code"),
  },
  (table) => [
    unique("analysis_runs_workspace_id_idempotency_key_key").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    check(
      "analysis_runs_state_check",
      sql`${table.state} IN ('claimed', 'provider_started', 'succeeded', 'failed')`,
    ),
    index("analysis_runs_expiry_idx").on(table.expiresAt),
  ],
);

export const analysisQuotaBuckets = pgTable(
  "analysis_quota_buckets",
  {
    scope: text("scope").notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    count: integer("count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.bucketStart] }),
    check("analysis_quota_buckets_count_check", sql`${table.count} >= 0`),
    index("analysis_quota_buckets_expiry_idx").on(table.expiresAt),
  ],
);

export const savedAnalyses = pgTable(
  "saved_analyses",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => guestWorkspaces.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").notNull(),
    source: jsonb("source").notNull(),
    report: jsonb("report").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastAccessedAt: timestamp("last_accessed_at", {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "saved_analyses_source_kind_check",
      sql`${table.sourceKind} IN ('dataset', 'text')`,
    ),
    index("saved_analyses_workspace_expiry_idx").on(
      table.workspaceId,
      table.expiresAt,
    ),
  ],
);

export const savedAnalysisMessages = pgTable(
  "saved_analysis_messages",
  {
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => savedAnalyses.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.analysisId, table.messageId] }),
    unique("saved_analysis_messages_sequence_key").on(table.sequence),
    check(
      "saved_analysis_messages_role_check",
      sql`${table.role} IN ('user', 'assistant')`,
    ),
    index("saved_analysis_messages_analysis_sequence_idx").on(
      table.analysisId,
      table.sequence,
    ),
  ],
);
