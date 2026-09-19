import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSafeAnalysisRuntime } from "./analysis-runtime";

const safeEnvironment = {
  DATABASE_URL: "postgresql://test.invalid/db",
  OPENAI_API_KEY: "test-key",
  OPENAI_BASE_URL: "https://gateway.example/v1",
  AI_MODEL: "test-model",
  SESSION_PASSWORD: "x".repeat(32),
  RATE_LIMIT_SALT: "test-salt",
  CRON_SECRET: "test-cron-secret",
  ANALYSIS_WORKSPACE_DAILY_LIMIT: "2",
  ANALYSIS_IP_DAILY_LIMIT: "3",
  ANALYSIS_GLOBAL_DAILY_LIMIT: "4",
} as const;

function setSafeEnvironment() {
  for (const [name, value] of Object.entries(safeEnvironment))
    vi.stubEnv(name, value);
}

afterEach(() => vi.unstubAllEnvs());

describe("analysis runtime guard", () => {
  it("accepts only the canonical complete configuration", () => {
    setSafeEnvironment();
    expect(hasSafeAnalysisRuntime()).toBe(true);
  });

  it.each([
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "AI_MODEL",
    "RATE_LIMIT_SALT",
    "CRON_SECRET",
  ] as const)("fails closed when %s is missing", (name) => {
    setSafeEnvironment();
    vi.stubEnv(name, "");
    expect(hasSafeAnalysisRuntime()).toBe(false);
  });

  it("rejects a short session password and non-positive caps", () => {
    setSafeEnvironment();
    vi.stubEnv("SESSION_PASSWORD", "too-short");
    expect(hasSafeAnalysisRuntime()).toBe(false);
    vi.stubEnv("SESSION_PASSWORD", "x".repeat(32));
    vi.stubEnv("ANALYSIS_GLOBAL_DAILY_LIMIT", "0");
    expect(hasSafeAnalysisRuntime()).toBe(false);
  });

  it("rejects whitespace-only secrets", () => {
    setSafeEnvironment();
    vi.stubEnv("RATE_LIMIT_SALT", "   ");
    expect(hasSafeAnalysisRuntime()).toBe(false);
  });

  it("does not accept legacy gateway environment names", () => {
    setSafeEnvironment();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("INSPIRO_GATEWAY_API_KEY", "legacy-key");
    vi.stubEnv("AI_GATEWAY_URL", "https://legacy.example/v1");
    expect(hasSafeAnalysisRuntime()).toBe(false);
  });
});
