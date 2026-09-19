import { describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/entities/dataset";
import type { FinalReport } from "@/entities/report";
import { inputLimits } from "@/shared/config";
import { createAnalyzeHandler } from "./handler";

const workspace = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-10-19T00:00:00.000Z",
};
const key = "00000000-0000-4000-8000-000000000002";
const source: Dataset = {
  version: 1,
  id: "full-source",
  source: { kind: "csv" },
  columns: [{ id: "value", label: "Value", scalarType: "number" }],
  rows: Array.from({ length: 13 }, (_, index) => ({
    id: `row-${index + 1}`,
    values: { value: index === 12 ? 999 : index + 1 },
    provenance: { sourceRowNumber: index + 2 },
  })),
};
const report: FinalReport = {
  version: 1,
  hero: [
    {
      text: "Checked result.",
      factIds: ["maximum"],
      evidenceIds: [],
      kind: "observation",
    },
    {
      text: "The checked result is confirmed.",
      factIds: ["maximum"],
      evidenceIds: [],
      kind: "observation",
    },
  ],
  metrics: [
    {
      id: "maximum",
      label: "Maximum",
      value: 999,
      evidenceIds: ["all-rows"],
    },
  ],
  charts: [],
  evidence: [
    {
      id: "all-rows",
      kind: "row-range",
      label: "All rows",
      coverage: { included: 13, total: 13 },
    },
  ],
  recommendations: [],
  noChartReason: "No chart needed.",
};

class TestGate {
  private state:
    | { kind: "empty" }
    | { kind: "claimed"; receiptId: string }
    | { kind: "provider-started"; receiptId: string }
    | { kind: "succeeded"; report: FinalReport }
    | { kind: "failed"; providerSpent: boolean; failureCode: string } = {
    kind: "empty",
  };

  claim() {
    if (this.state.kind === "succeeded")
      return Promise.resolve({
        kind: "replay",
        report: this.state.report,
      } as const);
    if (
      this.state.kind === "provider-started" ||
      (this.state.kind === "failed" && this.state.providerSpent)
    )
      return Promise.resolve({ kind: "provider-started" } as const);
    this.state = { kind: "claimed", receiptId: "receipt" };
    return Promise.resolve({ kind: "claimed", receiptId: "receipt" } as const);
  }

  markProviderStarted(_workspaceId: string, receiptId: string) {
    if (this.state.kind !== "claimed") return Promise.resolve(false);
    this.state = { kind: "provider-started", receiptId };
    return Promise.resolve(true);
  }

  succeed(_workspaceId: string, _receiptId: string, value: FinalReport) {
    if (this.state.kind !== "provider-started") return Promise.resolve(false);
    this.state = { kind: "succeeded", report: value };
    return Promise.resolve(true);
  }

  fail(
    _workspaceId: string,
    _receiptId: string,
    providerSpent: boolean,
    failureCode: string,
  ) {
    this.state = { kind: "failed", providerSpent, failureCode };
    return Promise.resolve(true);
  }

  snapshot() {
    return this.state;
  }
}

function request(
  body: unknown = { source },
  headers: Record<string, string> = {},
) {
  return new Request("https://example.test/api/analyze", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
      "idempotency-key": key,
      "x-forwarded-for": "203.0.113.4, 10.0.0.1",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(overrides: Record<string, unknown> = {}) {
  const analyze = vi.fn(async (accepted: Dataset) => {
    expect(accepted.rows[12]?.values.value).toBe(999);
    return report;
  });
  return {
    runtimeSafe: () => true,
    readWorkspace: async () => workspace,
    isWorkspaceActive: async () => true,
    hashIp: vi.fn(() => "hashed-ip"),
    validCodeFingerprint: () => true,
    gate: () => new TestGate(),
    analyze,
    saveAnalysis: vi.fn(async () => true),
    ...overrides,
  };
}

describe("POST /api/analyze handler", () => {
  it("rejects missing origin, session, and idempotency key before inference", async () => {
    const analyze = vi.fn(async () => report);
    const base = dependencies({ analyze });
    const noOrigin = request();
    noOrigin.headers.delete("origin");
    expect((await createAnalyzeHandler(base)(noOrigin)).status).toBe(403);
    expect(
      (
        await createAnalyzeHandler({
          ...base,
          readWorkspace: async () => undefined,
        })(request())
      ).status,
    ).toBe(401);
    expect(
      (
        await createAnalyzeHandler({
          ...base,
          isWorkspaceActive: async () => false,
        })(request())
      ).status,
    ).toBe(401);
    const noKey = request();
    noKey.headers.delete("idempotency-key");
    expect((await createAnalyzeHandler(base)(noKey)).status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects byte-over-limit and forged canonical text bodies", async () => {
    const handler = createAnalyzeHandler(dependencies());
    const oversized = request("я".repeat(inputLimits.canonicalSourceBytes));
    expect((await handler(oversized)).status).toBe(413);
    const forgedText = {
      source: {
        version: 1,
        id: "text",
        source: { kind: "text" },
        rawText: "First paragraph.\n\nSecond paragraph.",
        paragraphs: [{ index: 1, text: "Invented paragraph." }],
      },
    };
    const response = await handler(request(forgedText));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ code: "invalid-source" });
  });

  it.each([
    [{ kind: "quota", scope: "workspace" }, 429, "quota"],
    [{ kind: "conflict" }, 409, "conflict"],
    [{ kind: "in-flight" }, 409, "in-flight"],
    [{ kind: "provider-started" }, 409, "indeterminate"],
    [{ kind: "unavailable" }, 503, "unavailable"],
  ] as const)(
    "maps %s without calling the provider",
    async (outcome, status, code) => {
      const analyze = vi.fn(async () => report);
      const handler = createAnalyzeHandler(
        dependencies({
          analyze,
          gate: () => ({ claim: async () => outcome }),
        }),
      );
      const response = await handler(request());
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ code });
      expect(analyze).not.toHaveBeenCalled();
    },
  );

  it("marks provider start immediately before one call, then replays with zero additional calls", async () => {
    const events: string[] = [];
    const gate = new TestGate();
    const originalMark = gate.markProviderStarted.bind(gate);
    gate.markProviderStarted = async (...arguments_) => {
      events.push("provider-started");
      return originalMark(...arguments_);
    };
    const analyze = vi.fn(async () => {
      events.push("provider-call");
      return report;
    });
    const handler = createAnalyzeHandler(
      dependencies({ gate: () => gate, analyze }),
    );
    expect((await handler(request())).status).toBe(200);
    expect((await handler(request())).status).toBe(200);
    expect(events).toEqual(["provider-started", "provider-call"]);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it("rejects an incompatible one-item report on replay", async () => {
    const handler = createAnalyzeHandler(
      dependencies({
        gate: () => ({
          claim: async () => ({
            kind: "replay",
            report: { ...report, hero: [report.hero[0]] },
          }),
        }),
      }),
    );
    const response = await handler(request());
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ code: "invalid-report" });
  });

  it("persists the immutable source/report under the retry-safe analysis id", async () => {
    const saveAnalysis = vi.fn(async () => true);
    const gate = new TestGate();
    const handler = createAnalyzeHandler(
      dependencies({ gate: () => gate, saveAnalysis }),
    );

    const first = await handler(request());
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      analysisId: key,
      report,
    });
    expect(saveAnalysis).toHaveBeenCalledWith({
      analysisId: key,
      workspaceId: workspace.id,
      source,
      report,
    });

    const replay = await handler(request());
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ analysisId: key });
    expect(saveAnalysis).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a completed report cannot be stored", async () => {
    const handler = createAnalyzeHandler(
      dependencies({ saveAnalysis: async () => false }),
    );
    const response = await handler(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ code: "unavailable" });
  });

  it("hashes only the first forwarded address before claiming", async () => {
    const hashIp = vi.fn(() => "hashed-ip");
    const handler = createAnalyzeHandler(dependencies({ hashIp }));
    expect((await handler(request())).status).toBe(200);
    expect(hashIp).toHaveBeenCalledWith("203.0.113.4");
  });

  it("derives the same fingerprint regardless of JSON property order", async () => {
    const fingerprints: string[] = [];
    const gate = () => ({
      claim: async (input: { fingerprint: string }) => {
        fingerprints.push(input.fingerprint);
        return { kind: "unavailable" } as const;
      },
    });
    const handler = createAnalyzeHandler(dependencies({ gate }));
    await handler(request());
    await handler(
      request({
        source: {
          rows: source.rows,
          columns: source.columns,
          source: source.source,
          id: source.id,
          version: source.version,
        },
      }),
    );
    expect(fingerprints).toHaveLength(2);
    expect(fingerprints[0]).toBe(fingerprints[1]);
  });

  it("records provider-spent failure and makes the matching retry indeterminate", async () => {
    const gate = new TestGate();
    const analyze = vi.fn(async () => {
      throw Object.assign(new Error("gateway failed"), { code: "provider" });
    });
    const handler = createAnalyzeHandler(
      dependencies({ gate: () => gate, analyze }),
    );
    expect((await handler(request())).status).toBe(502);
    const retry = await handler(request());
    expect(retry.status).toBe(409);
    await expect(retry.json()).resolves.toEqual({ code: "indeterminate" });
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(gate.snapshot()).toMatchObject({
      kind: "failed",
      providerSpent: true,
      failureCode: "provider",
    });
  });

  it("records a spent indeterminate state when receipt persistence fails", async () => {
    const fail = vi.fn(async () => true);
    const events: string[] = [];
    const handler = createAnalyzeHandler(
      dependencies({
        gate: () => ({
          claim: async () => ({ kind: "claimed", receiptId: "receipt" }),
          markProviderStarted: async () => {
            events.push("started");
            return true;
          },
          succeed: async () => false,
          fail,
        }),
        analyze: async () => {
          events.push("provider");
          return report;
        },
      }),
    );
    const response = await handler(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ code: "indeterminate" });
    expect(events).toEqual(["started", "provider"]);
    expect(fail).toHaveBeenCalledWith(
      workspace.id,
      "receipt",
      true,
      "indeterminate",
    );
  });
});
