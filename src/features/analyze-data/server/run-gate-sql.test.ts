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
});
