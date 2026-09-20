import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type Dataset,
  datasetSchema,
  isShowcaseDemoSource,
  type TextSource,
  textSourceSchema,
} from "@/entities/dataset";
import type { GuestWorkspace } from "@/entities/guest-workspace";
import { type FinalReport, finalReportSchema } from "@/entities/report";
import {
  type AnalysisFocus,
  analysisFocusSchema,
} from "@/features/analyze-data";
import type { RunGateOutcome } from "@/features/analyze-data/server";
import { inputLimits } from "@/shared/config";
import { stableJson } from "@/shared/lib/stable-json";
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
  readInviteCodeFingerprint?(): Promise<string | undefined>;
  isWorkspaceActive(id: string, now: Date): Promise<boolean>;
  hashIp(ip: string): string | undefined;
  validCodeFingerprint?(fingerprint: string): boolean;
  gate(): AnalyzeGate;
  analyze(source: CanonicalSource, focus?: AnalysisFocus): Promise<FinalReport>;
  saveAnalysis(input: {
    analysisId: string;
    workspaceId: string;
    source: CanonicalSource;
    report: FinalReport;
  }): Promise<{ expiresAt: Date } | undefined>;
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

function parseRequest(
  body: string,
): { source: CanonicalSource; focus?: AnalysisFocus } | undefined {
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
    Object.keys(value).some((key) => key !== "source" && key !== "focus") ||
    !("source" in value)
  )
    return undefined;
  const parsedFocus = analysisFocusSchema.safeParse(
    "focus" in value ? (value as { focus: unknown }).focus : "",
  );
  if (!parsedFocus.success) return undefined;
  const source = (value as { source: unknown }).source;
  const dataset = datasetSchema.safeParse(source);
  if (dataset.success)
    return {
      source: dataset.data,
      ...(parsedFocus.data ? { focus: parsedFocus.data } : {}),
    };
  const text = textSourceSchema.safeParse(source);
  return text.success && canonicalText(text.data)
    ? {
        source: text.data,
        ...(parsedFocus.data ? { focus: parsedFocus.data } : {}),
      }
    : undefined;
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function gateResponse(
  outcome: Exclude<
    RunGateOutcome<FinalReport>,
    { kind: "claimed" } | { kind: "replay" }
  >,
) {
  switch (outcome.kind) {
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
      body = await readBoundedBody(
        request,
        inputLimits.canonicalSourceBytes + 4 * 1024,
      );
    } catch (error) {
      return error instanceof BodyTooLargeError
        ? privateJson({ code: "too-large" }, 413)
        : privateJson({ code: "invalid-source" }, 422);
    }
    const parsedRequest = parseRequest(body);
    if (!parsedRequest) return privateJson({ code: "invalid-source" }, 422);
    const source = parsedRequest.source;
    const canonicalSourceBytes = new TextEncoder().encode(
      JSON.stringify(source),
    ).byteLength;
    if (canonicalSourceBytes > inputLimits.canonicalSourceBytes)
      return privateJson({ code: "too-large" }, 413);
    const focus = parsedRequest.focus;

    const ipHash = dependencies.hashIp(requestIp(request));
    if (!ipHash) return privateJson({ code: "unavailable" }, 503);
    const fingerprint = createHash("sha256")
      .update(stableJson({ source, ...(focus ? { focus } : {}) }))
      .digest("hex");
    let gate: AnalyzeGate;
    let outcome: RunGateOutcome<FinalReport>;
    try {
      gate = dependencies.gate();
      const storedCodeFingerprint =
        await dependencies.readInviteCodeFingerprint?.();
      const codeFingerprint =
        storedCodeFingerprint &&
        (dependencies.validCodeFingerprint?.(storedCodeFingerprint) ?? true)
          ? storedCodeFingerprint
          : undefined;
      outcome = await gate.claim({
        workspaceId: workspace.id,
        ipHash: isShowcaseDemoSource(source)
          ? `showcase-demo:${ipHash}`
          : ipHash,
        key,
        fingerprint,
        ...(codeFingerprint ? { codeFingerprint } : {}),
      });
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }
    if (outcome.kind === "replay") {
      const storedReport = finalReportSchema.safeParse(outcome.report);
      if (!storedReport.success)
        return privateJson({ code: "invalid-report" }, 502);
      try {
        const saved = await dependencies.saveAnalysis({
          analysisId: key,
          workspaceId: workspace.id,
          source,
          report: storedReport.data,
        });
        if (!saved) return privateJson({ code: "unavailable" }, 503);
        return privateJson({
          analysisId: key,
          report: storedReport.data,
          expiresAt: saved.expiresAt.toISOString(),
        });
      } catch {
        return privateJson({ code: "unavailable" }, 503);
      }
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
        await dependencies.analyze(source, focus),
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
      if (await gate.succeed(workspace.id, receiptId, report)) {
        const saved = await dependencies.saveAnalysis({
          analysisId: key,
          workspaceId: workspace.id,
          source,
          report,
        });
        if (!saved) return privateJson({ code: "unavailable" }, 503);
        return privateJson({
          analysisId: key,
          report,
          expiresAt: saved.expiresAt.toISOString(),
        });
      }
    } catch {
      return privateJson({ code: "unavailable" }, 503);
    }
    try {
      await gate.fail(workspace.id, receiptId, true, "indeterminate");
    } catch {}
    return privateJson({ code: "indeterminate" }, 503);
  };
}
