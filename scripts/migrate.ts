import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "@neondatabase/serverless";

const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
const migrationFilePattern = /^(\d+)_([\w-]+)\.sql$/;
const migrationLedger = "_datatale_migrations";

export type Migration = {
  filename: string;
  sql: string;
  checksum: string;
};

type MigrationRow = {
  filename: string;
  checksum: string;
};

export async function readMigrations(
  directory = migrationsDirectory,
): Promise<Migration[]> {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => {
      const leftNumber = Number(migrationFilePattern.exec(left)?.[1]);
      const rightNumber = Number(migrationFilePattern.exec(right)?.[1]);
      return leftNumber - rightNumber || left.localeCompare(right);
    });

  return Promise.all(
    names.map(async (filename) => {
      const contents = await readFile(join(directory, filename));
      return {
        filename,
        sql: contents.toString("utf8"),
        checksum: createHash("sha256").update(contents).digest("hex"),
      };
    }),
  );
}

export async function applyMigrations(
  client: PoolClient,
  migrations: Migration[],
): Promise<string[]> {
  await client.query("BEGIN");
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('datatale:migrations', 0))`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${migrationLedger} (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );

    const result = await client.query<MigrationRow>(
      `SELECT filename, checksum FROM ${migrationLedger} ORDER BY filename`,
    );
    const applied = new Map(
      result.rows.map((row) => [row.filename, row.checksum]),
    );
    const appliedNow: string[] = [];

    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.filename);
      if (previousChecksum !== undefined) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(`Migration checksum drift: ${migration.filename}`);
        }
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${migrationLedger} (filename, checksum) VALUES ($1, $2)`,
        [migration.filename, migration.checksum],
      );
      appliedNow.push(migration.filename);
    }

    await client.query("COMMIT");
    return appliedNow;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function migrate(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  directory = migrationsDirectory,
  pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined,
): Promise<string[]> {
  if (!databaseUrl?.trim() || !pool) {
    throw new Error("DATABASE_URL is required");
  }

  const client = await pool.connect();
  try {
    return await applyMigrations(client, await readMigrations(directory));
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  migrate()
    .then((applied) => {
      console.log(
        `Applied ${applied.length} migration${applied.length === 1 ? "" : "s"}.`,
      );
    })
    .catch(() => {
      console.error("Database migration failed.");
      process.exitCode = 1;
    });
}
