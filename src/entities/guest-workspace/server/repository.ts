import "server-only";
import { getDatabase } from "@/shared/lib/db";
import type { GuestWorkspace } from "../model/schema";
import type { GuestWorkspaceRepository } from "./bootstrap";

type Sql = ReturnType<typeof getDatabase>;

export class SqlGuestWorkspaceRepository implements GuestWorkspaceRepository {
  constructor(private readonly sql: Sql = getDatabase()) {}

  private client() {
    if (!this.sql) throw new Error("Database unavailable");
    return this.sql;
  }

  async isActive(id: string, now: Date) {
    const rows =
      await this.client()`SELECT id FROM guest_workspaces WHERE id = ${id} AND revoked_at IS NULL AND expires_at > ${now} LIMIT 1`;
    return rows.length === 1;
  }

  async create(workspace: GuestWorkspace) {
    const rows =
      await this.client()`INSERT INTO guest_workspaces (id, expires_at) VALUES (${workspace.id}, ${workspace.expiresAt}) ON CONFLICT (id) DO NOTHING RETURNING id`;
    return rows.length === 1;
  }

  async refresh(workspace: GuestWorkspace) {
    const rows =
      await this.client()`UPDATE guest_workspaces SET expires_at = ${workspace.expiresAt} WHERE id = ${workspace.id} AND revoked_at IS NULL RETURNING id`;
    return rows.length === 1;
  }
}
