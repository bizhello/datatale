import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const guestWorkspaces = pgTable("guest_workspaces", {
  id: uuid("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const analysisRuns = pgTable("analysis_runs", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => guestWorkspaces.id),
  idempotencyKey: text("idempotency_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  state: text("state").notNull(),
  providerStartedAt: timestamp("provider_started_at", { withTimezone: true }),
  leaseExpiresAt: timestamp("lease_expires_at", {
    withTimezone: true,
  }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  report: jsonb("report"),
  failureCode: text("failure_code"),
});

export const analysisQuotaBuckets = pgTable(
  "analysis_quota_buckets",
  {
    scope: text("scope").notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    count: text("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.bucketStart] })],
);
