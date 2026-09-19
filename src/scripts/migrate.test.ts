import { describe, expect, it, vi } from "vitest";
import {
  applyMigrations,
  type Migration,
  readMigrations,
} from "../../scripts/migrate";

const migration = (filename: string, sql: string): Migration => ({
  filename,
  sql,
  checksum: `checksum-${filename}`,
});

function fakeClient(rows: Array<{ filename: string; checksum: string }> = []) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT filename")) return { rows };
    if (sql.includes("AS has_objects"))
      return { rows: [{ has_objects: false }] };
    return { rows: [] };
  });
  return { query, release: vi.fn() };
}

describe("database migration runner", () => {
  it("sorts migrations by numeric prefix", async () => {
    const migrations = await readMigrations("migrations");
    expect(migrations.map(({ filename }) => filename)).toEqual([
      "0001_ai_dashboard.sql",
      "0002_access_gate.sql",
      "0003_saved_analysis.sql",
      "0004_chat_inference_leases.sql",
      "0005_strict_report_hero.sql",
    ]);
  });

  it("locks, applies SQL, records checksums, and commits in order", async () => {
    const client = fakeClient();
    const applied = await applyMigrations(client as never, [
      migration("0001_first.sql", "CREATE TABLE first (id int)"),
      migration("0002_second.sql", "CREATE TABLE second (id int)"),
    ]);

    expect(applied).toEqual(["0001_first.sql", "0002_second.sql"]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "SELECT pg_advisory_xact_lock(hashtextextended('datatale:migrations', 0))",
      expect.stringContaining(
        "CREATE TABLE IF NOT EXISTS _datatale_migrations",
      ),
      "SELECT filename, checksum FROM _datatale_migrations ORDER BY filename",
      expect.stringContaining("AS has_objects"),
      "CREATE TABLE first (id int)",
      expect.stringContaining("INSERT INTO _datatale_migrations"),
      "CREATE TABLE second (id int)",
      expect.stringContaining("INSERT INTO _datatale_migrations"),
      "COMMIT",
    ]);
  });

  it("rejects checksum drift and rolls back without applying later SQL", async () => {
    const client = fakeClient([
      { filename: "0001_first.sql", checksum: "old" },
    ]);

    await expect(
      applyMigrations(client as never, [
        migration("0001_first.sql", "CREATE TABLE first (id int)"),
      ]),
    ).rejects.toThrow("Migration checksum drift: 0001_first.sql");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith(
      "CREATE TABLE first (id int)",
    );
  });

  it("rejects ledger entries without a matching migration file", async () => {
    const client = fakeClient([
      { filename: "0000_removed.sql", checksum: "checksum" },
    ]);

    await expect(applyMigrations(client as never, [])).rejects.toThrow(
      "Migration ledger contains an unknown file: 0000_removed.sql",
    );
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("rejects a non-empty schema when bootstrapping an empty ledger", async () => {
    const client = fakeClient();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT filename")) return { rows: [] };
      if (sql.includes("AS has_objects"))
        return { rows: [{ has_objects: true }] };
      return { rows: [] };
    });

    await expect(
      applyMigrations(client as never, [
        migration("0001_first.sql", "CREATE TABLE first (id int)"),
      ]),
    ).rejects.toThrow(
      "Migration ledger is empty but the database schema is not empty",
    );
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith(
      "CREATE TABLE first (id int)",
    );
  });

  it("rejects a ledger gap before applying a newer migration", async () => {
    const client = fakeClient([
      { filename: "0002_second.sql", checksum: "checksum-0002_second.sql" },
    ]);

    await expect(
      applyMigrations(client as never, [
        migration("0001_first.sql", "CREATE TABLE first (id int)"),
        migration("0002_second.sql", "CREATE TABLE second (id int)"),
      ]),
    ).rejects.toThrow(
      "Migration ledger is missing an earlier file before 0002_second.sql",
    );
    expect(client.query).not.toHaveBeenCalledWith(
      "CREATE TABLE first (id int)",
    );
  });
});
