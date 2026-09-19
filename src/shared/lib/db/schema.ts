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
    check(
      "analysis_runs_report_hero_count_check",
      sql`${table.report} IS NULL OR (jsonb_typeof(${table.report} -> 'hero') IS NOT DISTINCT FROM 'array' AND jsonb_array_length(${table.report} -> 'hero') BETWEEN 2 AND 3)`,
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
    check(
      "saved_analyses_report_hero_count_check",
      sql`jsonb_typeof(${table.report} -> 'hero') IS NOT DISTINCT FROM 'array' AND jsonb_array_length(${table.report} -> 'hero') BETWEEN 2 AND 3`,
    ),
    index("saved_analyses_workspace_expiry_idx").on(
      table.workspaceId,
      table.expiresAt,
    ),
    index("saved_analyses_expiry_idx").on(table.expiresAt),
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
    result: jsonb("result"),
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

export const savedAnalysisInferenceLeases = pgTable(
  "saved_analysis_inference_leases",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => savedAnalyses.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    leaseToken: uuid("lease_token").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.analysisId, table.messageId] }),
    index("saved_analysis_inference_leases_expiry_idx").on(
      table.leaseExpiresAt,
    ),
  ],
);
