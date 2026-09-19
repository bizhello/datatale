import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { analysisQuotaBuckets, analysisRuns } from "./schema";

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
});
