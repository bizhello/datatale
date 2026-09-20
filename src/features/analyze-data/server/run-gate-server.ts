import "server-only";
import { createHash } from "node:crypto";
import { workspaceDailyQuota } from "@/shared/config";
import { RunGate, type RunGateConfig } from "./run-gate";
import { SqlRunGateRepository } from "./run-gate-repository";

function positive(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}
export function hashIp(ip: string) {
  const salt = process.env.RATE_LIMIT_SALT;
  return salt
    ? createHash("sha256").update(`${salt}:${ip}`).digest("hex")
    : undefined;
}
export function getRunGateConfig(): RunGateConfig {
  return {
    freeWorkspaceDailyLimit: workspaceDailyQuota.free,
    unlockedWorkspaceDailyLimit: workspaceDailyQuota.unlocked,
    ipDailyLimit: positive(process.env.ANALYSIS_IP_DAILY_LIMIT),
    globalDailyLimit: positive(process.env.ANALYSIS_GLOBAL_DAILY_LIMIT),
  };
}
export function getRunGate<Report = unknown>() {
  return new RunGate<Report>(
    new SqlRunGateRepository<Report>(),
    getRunGateConfig(),
  );
}
export function cleanupAnalysisGate(now = new Date()) {
  return new SqlRunGateRepository().cleanup(now);
}
export function deleteAnalysisWorkspace(workspaceId: string) {
  return new SqlRunGateRepository().deleteWorkspace(workspaceId);
}
