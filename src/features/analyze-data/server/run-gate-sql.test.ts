import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("claim_analysis_run migration contract", () => {
  it("keeps key locking, all quota locks, quota increments, workspace touch, and receipt write in one function", async () => {
    const migration = await readFile(
      "migrations/0001_ai_dashboard.sql",
      "utf8",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION claim_analysis_run",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("UPDATE guest_workspaces SET expires_at");
    expect(migration).toContain("INSERT INTO analysis_quota_buckets");
    expect(migration).toContain(
      "UPDATE analysis_quota_buckets b SET count = b.count + 1",
    );
    expect(migration).toContain("INSERT INTO analysis_runs");
  });

  it("keeps migration variables distinct from bucket columns and preserves the legacy overload", async () => {
    const [initial, upgrade] = await Promise.all([
      readFile("migrations/0001_ai_dashboard.sql", "utf8"),
      readFile("migrations/0002_access_gate.sql", "utf8"),
    ]);
    for (const migration of [initial, upgrade]) {
      expect(migration).toContain("quota_bucket_start");
      expect(migration).toContain("access_bucket_start");
      expect(migration).toContain("ON CONFLICT (scope, bucket_start)");
      expect(migration).toContain(
        "CREATE OR REPLACE FUNCTION claim_analysis_run(",
      );
      expect(migration).not.toContain("DROP FUNCTION claim_analysis_run");
    }
    expect(upgrade).toContain("p_code_fingerprint text");
    expect(upgrade).toContain("NULL::text");
  });
});
