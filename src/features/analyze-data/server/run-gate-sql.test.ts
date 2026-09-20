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

  it("keeps migration variables distinct and removes only the legacy overload", async () => {
    const [initial, upgrade, cleanup] = await Promise.all([
      readFile("migrations/0001_ai_dashboard.sql", "utf8"),
      readFile("migrations/0002_access_gate.sql", "utf8"),
      readFile("migrations/0005_strict_report_hero.sql", "utf8"),
    ]);
    for (const migration of [initial, upgrade]) {
      expect(migration).toContain("quota_bucket_start");
      expect(migration).toContain("access_bucket_start");
      expect(migration).toContain("ON CONFLICT (scope, bucket_start)");
      expect(migration).toContain(
        "CREATE OR REPLACE FUNCTION claim_analysis_run(",
      );
    }
    expect(upgrade).toContain("p_code_fingerprint text");
    expect(upgrade).toContain("p_code_limit integer");
    expect(cleanup).toMatch(
      /DROP FUNCTION IF EXISTS claim_analysis_run\(\s*uuid,\s*uuid,\s*text,\s*text,\s*text,\s*timestamptz,\s*integer,\s*integer,\s*integer,\s*integer,\s*integer,\s*integer\s*\);/,
    );
    expect(cleanup).not.toMatch(
      /DROP FUNCTION IF EXISTS claim_analysis_run\(\s*uuid,\s*uuid,\s*text,\s*text,\s*text,\s*text,\s*timestamptz,\s*integer,\s*integer,\s*integer,\s*integer,\s*integer,\s*integer,\s*integer\s*\);/,
    );
  });

  it("raises the workspace limit without a shared code bucket or removed legacy signature", async () => {
    const migration = await readFile(
      "migrations/0006_workspace_tier_quotas.sql",
      "utf8",
    );
    expect(migration).toContain(
      "workspace_limit integer := CASE WHEN p_code_fingerprint IS NULL THEN p_workspace_limit ELSE p_code_limit END",
    );
    expect(migration).toContain("'workspace:' || p_workspace_id::text");
    expect(migration).not.toContain("'code:' || p_code_fingerprint");
    expect(
      migration.match(/CREATE OR REPLACE FUNCTION claim_analysis_run\(/g),
    ).toHaveLength(1);
    expect(migration).toContain("p_code_fingerprint text, p_now timestamptz");
    expect(migration).not.toMatch(
      /p_ip_hash text,\s*p_now timestamptz, p_workspace_limit integer/,
    );
  });
});
