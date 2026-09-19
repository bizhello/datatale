import { sql } from "drizzle-orm";
import {
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
