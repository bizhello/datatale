import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type Dataset,
  datasetSchema,
  type TextSource,
  textSourceSchema,
} from "@/entities/dataset";
import type { GuestWorkspace } from "@/entities/guest-workspace";
import { type FinalReport, finalReportSchema } from "@/entities/report";
import type { RunGateOutcome } from "@/features/analyze-data/server";
import { inputLimits } from "@/shared/config";
import {
  BodyTooLargeError,
  isSameOrigin,
  privateJson,
  readBoundedBody,
} from "../private-http";

type CanonicalSource = Dataset | TextSource;

type AnalyzeGate = Readonly<{
  claim(input: {
    workspaceId: string;
    ipHash: string;
    key: string;
    fingerprint: string;
  }): Promise<RunGateOutcome<FinalReport>>;
  markProviderStarted(workspaceId: string, receiptId: string): Promise<boolean>;
  succeed(
    workspaceId: string,
    receiptId: string,
    report: FinalReport,
  ): Promise<boolean>;
  fail(
    workspaceId: string,
    receiptId: string,
    providerSpent: boolean,
    code: string,
  ): Promise<boolean>;
}>;

type AnalyzeHandlerDependencies = Readonly<{
  runtimeSafe(): boolean;
  readWorkspace(): Promise<GuestWorkspace | undefined>;
  isWorkspaceActive(id: string, now: Date): Promise<boolean>;
  hashIp(ip: string): string | undefined;
  gate(): AnalyzeGate;
  analyze(source: CanonicalSource): Promise<FinalReport>;
}>;

const idempotencyKeySchema = z.string().uuid();

function canonicalText(source: TextSource) {
  const paragraphs = source.rawText
    .split(/\r?\n\s*\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ index: index + 1, text }));
  return (
    source.rawText.length <= inputLimits.textCharacters &&
    JSON.stringify(source.paragraphs) === JSON.stringify(paragraphs)
  );
}

function parseSource(body: string): CanonicalSource | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("source" in value)
  )
    return undefined;
  const source = (value as { source: unknown }).source;
  const dataset = datasetSchema.safeParse(source);
  if (dataset.success) return dataset.data;
  const text = textSourceSchema.safeParse(source);
  return text.success && canonicalText(text.data) ? text.data : undefined;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function gateResponse(
  outcome: Exclude<RunGateOutcome<FinalReport>, { kind: "claimed" }>,
) {
  switch (outcome.kind) {
    case "replay": {
      const report = finalReportSchema.safeParse(outcome.report);
      return report.success
        ? privateJson({ report: report.data })
        : privateJson({ code: "invalid-report" }, 502);
    }
    case "quota":
      return privateJson({ code: "quota", scope: outcome.scope }, 429);
    case "conflict":
      return privateJson({ code: "conflict" }, 409);
    case "in-flight":
      return privateJson({ code: "in-flight" }, 409);
    case "provider-started":
      return privateJson({ code: "indeterminate" }, 409);
    case "expired":
      return privateJson({ code: "expired" }, 401);
    case "unavailable":
      return privateJson({ code: "unavailable" }, 503);
  }
}

function failure(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "provider";
  if (code === "timeout") return { receiptCode: code, status: 504, code };
  if (code === "unavailable" || code === "configuration")
    return { receiptCode: code, status: 503, code };
  if (code === "invalid-model-output" || code === "unsupported-plan")
    return { receiptCode: code, status: 502, code: "invalid-report" };
  return { receiptCode: code, status: 502, code: "provider" };
}

export function createAnalyzeHandler(dependencies: AnalyzeHandlerDependencies) {
  return async function handleAnalyze(request: Request) {
    if (!dependencies.runtimeSafe())
      return privateJson({ code: "unavailable" }, 503);
    if (!isSameOrigin(request)) return privateJson({ code: "csrf" }, 403);

    const workspace = await dependencies.readWorkspace();
    if (!workspace) return privateJson({ code: "expired" }, 401);
    try {
      if (!(await dependencies.isWorkspaceActive(workspace.id, new Date())))
        return privateJson({ code: "expired" }, 401);
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }

    const key = request.headers.get("idempotency-key");
    if (!key || !idempotencyKeySchema.safeParse(key).success)
      return privateJson({ code: "invalid-idempotency-key" }, 400);

    let body: string;
    try {
      body = await readBoundedBody(request, inputLimits.canonicalSourceBytes);
    } catch (error) {
      return error instanceof BodyTooLargeError
        ? privateJson({ code: "too-large" }, 413)
        : privateJson({ code: "invalid-source" }, 422);
    }
    const source = parseSource(body);
    if (!source) return privateJson({ code: "invalid-source" }, 422);

    const ipHash = dependencies.hashIp(requestIp(request));
    if (!ipHash) return privateJson({ code: "unavailable" }, 503);
    const fingerprint = createHash("sha256")
      .update(stableJson(source))
      .digest("hex");
    let gate: AnalyzeGate;
    let outcome: RunGateOutcome<FinalReport>;
    try {
      gate = dependencies.gate();
      outcome = await gate.claim({
        workspaceId: workspace.id,
        ipHash,
        key,
        fingerprint,
      });
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }
    if (outcome.kind !== "claimed") return gateResponse(outcome);

    const { receiptId } = outcome;
    try {
      if (!(await gate.markProviderStarted(workspace.id, receiptId))) {
        await gate.fail(workspace.id, receiptId, false, "unavailable");
        return privateJson({ code: "unavailable" }, 503);
      }
    } catch {
      try {
        await gate.fail(workspace.id, receiptId, false, "unavailable");
      } catch {}
      return privateJson({ code: "unavailable" }, 503);
    }

    let report: FinalReport;
    try {
      const parsedReport = finalReportSchema.safeParse(
        await dependencies.analyze(source),
      );
      if (!parsedReport.success)
        throw Object.assign(new Error("Invalid final report."), {
          code: "invalid-model-output",
        });
      report = parsedReport.data;
    } catch (error) {
      const mapped = failure(error);
      try {
        await gate.fail(workspace.id, receiptId, true, mapped.receiptCode);
      } catch {}
      return privateJson({ code: mapped.code }, mapped.status);
    }

    try {
      if (await gate.succeed(workspace.id, receiptId, report))
        return privateJson({ report });
    } catch {}
    try {
      await gate.fail(workspace.id, receiptId, true, "indeterminate");
    } catch {}
    return privateJson({ code: "indeterminate" }, 503);
  };
}
