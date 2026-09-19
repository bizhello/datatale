import { randomUUID } from "node:crypto";
import {
  type AcceptedSource,
  assertStoragePayloads,
  SAVED_ANALYSIS_HISTORY_MAX_MESSAGES,
  SAVED_ANALYSIS_TTL_MS,
  type SavedAnalysis,
  type SavedAnalysisMessage,
  type SavedAnalysisValidators,
  type SavedMessageInput,
  savedAnalysisMessageSchema,
  savedAnalysisSchema,
  savedMessageInputSchema,
} from "../model/schema";
import type { SavedAnalysisRepository } from "./repository";

type Workspace = { expiresAt: Date; revoked: boolean };
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

export class MemorySavedAnalysisRepository implements SavedAnalysisRepository {
  private readonly analyses = new Map<string, SavedAnalysis>();
  private readonly messagesByAnalysis = new Map<
    string,
    SavedAnalysisMessage[]
  >();
  private readonly workspaces = new Map<string, Workspace>();
  private readonly chatCounts = new Map<string, number>();
  constructor(
    private readonly validators: SavedAnalysisValidators,
    workspaces: ReadonlyMap<string, Workspace> = new Map(),
  ) {
    for (const [id, workspace] of workspaces)
      this.workspaces.set(id, workspace);
  }
  addWorkspace(id: string, expiresAt: Date) {
    this.workspaces.set(id, { expiresAt, revoked: false });
  }
  revokeWorkspace(id: string) {
    const workspace = this.workspaces.get(id);
    if (workspace) workspace.revoked = true;
  }
  private active(workspaceId: string, now: Date) {
    const workspace = this.workspaces.get(workspaceId);
    return workspace && !workspace.revoked && workspace.expiresAt > now;
  }
  async create(input: {
    workspaceId: string;
    source: AcceptedSource;
    report: unknown;
    now?: Date;
    analysisId?: string;
  }) {
    const now = input.now ?? new Date();
    const payload = assertStoragePayloads(
      input.source,
      input.report,
      this.validators,
    );
    if (!this.active(input.workspaceId, now)) return undefined;
    const id = input.analysisId ?? randomUUID();
    const existing = this.analyses.get(id);
    if (existing) {
      if (
        existing.workspaceId !== input.workspaceId ||
        stableJson(existing.source) !== stableJson(payload.source) ||
        stableJson(existing.report) !== stableJson(payload.report)
      )
        throw new Error(
          "Saved analysis already exists with different immutable payloads.",
        );
      return existing;
    }
    const result = savedAnalysisSchema.parse({
      id,
      workspaceId: input.workspaceId,
      source: payload.source,
      report: payload.report,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + SAVED_ANALYSIS_TTL_MS),
    });
    this.analyses.set(id, result);
    this.messagesByAnalysis.set(id, []);
    return result;
  }
  async get(workspaceId: string, analysisId: string, now = new Date()) {
    const analysis = this.analyses.get(analysisId);
    if (
      !analysis ||
      analysis.workspaceId !== workspaceId ||
      !this.active(workspaceId, now) ||
      analysis.expiresAt <= now
    )
      return undefined;
    const result = {
      ...analysis,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + SAVED_ANALYSIS_TTL_MS),
    };
    this.analyses.set(analysisId, result);
    return result;
  }
  async list(workspaceId: string, now = new Date()) {
    return [...this.analyses.values()]
      .filter(
        (a) =>
          a.workspaceId === workspaceId &&
          this.active(workspaceId, now) &&
          a.expiresAt > now,
      )
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
  }
  async appendMessage(input: {
    workspaceId: string;
    analysisId: string;
    message: SavedMessageInput;
    dailyLimit: number;
    now?: Date;
  }) {
    const message = savedMessageInputSchema.parse(input.message);
    const now = input.now ?? new Date();
    const analysis = this.analyses.get(input.analysisId);
    if (
      !analysis ||
      analysis.workspaceId !== input.workspaceId ||
      !this.active(input.workspaceId, now) ||
      analysis.expiresAt <= now
    )
      return undefined;
    const history = this.messagesByAnalysis.get(input.analysisId) ?? [];
    const existing = history.find((item) => item.id === message.id);
    if (existing) {
      if (
        existing.role !== message.role ||
        existing.content !== message.content
      )
        throw new Error("Message ID already exists with different content.");
      return existing;
    }
    const key = `${input.workspaceId}:${now.toISOString().slice(0, 10)}`;
    const count = this.chatCounts.get(key) ?? 0;
    if (message.role === "user" && count >= input.dailyLimit)
      return "quota-exceeded" as const;
    const result = savedAnalysisMessageSchema.parse({
      id: message.id,
      analysisId: input.analysisId,
      role: message.role,
      content: message.content,
      createdAt: now,
    });
    history.push(result);
    this.messagesByAnalysis.set(input.analysisId, history);
    if (message.role === "user") this.chatCounts.set(key, count + 1);
    return result;
  }
  async messages(input: {
    workspaceId: string;
    analysisId: string;
    limit?: number;
    now?: Date;
  }) {
    const analysis = await this.get(
      input.workspaceId,
      input.analysisId,
      input.now,
    );
    if (!analysis) return [];
    const limit = Math.min(
      Math.max(
        Math.trunc(input.limit ?? SAVED_ANALYSIS_HISTORY_MAX_MESSAGES),
        1,
      ),
      SAVED_ANALYSIS_HISTORY_MAX_MESSAGES,
    );
    return (this.messagesByAnalysis.get(input.analysisId) ?? []).slice(-limit);
  }
}
