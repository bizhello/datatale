import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  analysisQuotaBuckets,
  analysisRuns,
  savedAnalyses,
  savedAnalysisInferenceLeases,
  savedAnalysisMessages,
} from "./schema";

describe("analysis Drizzle schema parity", () => {
  it("represents run ownership, state, uniqueness, and expiry index", () => {
    const config = getTableConfig(analysisRuns);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(
      config.uniqueConstraints.map((constraint) => constraint.name),
    ).toEqual(["analysis_runs_workspace_id_idempotency_key_key"]);
    expect(config.checks.map((check) => check.name)).toContain(
      "analysis_runs_state_check",
    );
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "analysis_runs_expiry_idx",
    );
  });

  it("uses an integer non-negative quota count and the migration index", () => {
    const config = getTableConfig(analysisQuotaBuckets);
    const count = config.columns.find((column) => column.name === "count");
    expect(count?.dataType).toBe("number");
    expect(count?.columnType).toBe("PgInteger");
    expect(count?.default).toBe(0);
    expect(config.checks.map((check) => check.name)).toContain(
      "analysis_quota_buckets_count_check",
    );
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "analysis_quota_buckets_expiry_idx",
    );
  });

  it("stores immutable analyses and ordered, idempotent messages with cascades", () => {
    const analyses = getTableConfig(savedAnalyses);
    const messages = getTableConfig(savedAnalysisMessages);
    expect(analyses.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(analyses.checks.map((check) => check.name)).toContain(
      "saved_analyses_source_kind_check",
    );
    expect(analyses.indexes.map((index) => index.config.name)).toContain(
      "saved_analyses_expiry_idx",
    );
    expect(messages.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(
      messages.primaryKeys[0]?.columns.map((column) => column.name),
    ).toEqual(["analysis_id", "message_id"]);
    expect(messages.indexes.map((index) => index.config.name)).toContain(
      "saved_analysis_messages_analysis_sequence_idx",
    );
  });

  it("keeps the durable storage migration portable and cascading", async () => {
    const migration = await readFile(
      "migrations/0003_saved_analysis.sql",
      "utf8",
    );
    expect(migration).toContain(
      "REFERENCES guest_workspaces(id) ON DELETE CASCADE",
    );
    expect(migration).toContain(
      "REFERENCES saved_analyses(id) ON DELETE CASCADE",
    );
    expect(migration).toContain("GENERATED ALWAYS AS IDENTITY");
    expect(migration).toContain("UNIQUE (analysis_id, message_id)");
    expect(migration).toContain(
      "saved_analysis_messages_analysis_sequence_idx",
    );
    expect(migration).toContain("saved_analyses_expiry_idx");
  });

  it("models one expiring inference lease per user message", async () => {
    const leases = getTableConfig(savedAnalysisInferenceLeases);
    expect(leases.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(leases.primaryKeys[0]?.columns.map((column) => column.name)).toEqual(
      ["analysis_id", "message_id"],
    );
    expect(leases.indexes.map((index) => index.config.name)).toContain(
      "saved_analysis_inference_leases_expiry_idx",
    );
    const migration = await readFile(
      "migrations/0004_chat_inference_leases.sql",
      "utf8",
    );
    expect(migration).toContain("PRIMARY KEY (analysis_id, message_id)");
    expect(migration).toContain("ON DELETE CASCADE");
  });
});
