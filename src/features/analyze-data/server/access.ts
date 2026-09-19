import "server-only";
import { getDatabase } from "@/shared/lib/db";

type Sql = ReturnType<typeof getDatabase>;

export class SqlAccessRepository {
  constructor(private readonly sql: Sql = getDatabase()) {}

  async allowInvalidAttempt(ipHash: string, now = new Date()) {
    if (!this.sql) throw new Error("Database unavailable");
    const rows = await this
      .sql`SELECT * FROM claim_access_attempt(${ipHash}, ${now}, 5, 172800000)`;
    return rows[0]?.allowed === true;
  }
}
