import { NextResponse } from "next/server";
import { datasetSchema, textSourceSchema } from "@/entities/dataset";
import { AnalysisError, analyzeSource } from "@/features/analyze-data/server";
import { inputLimits } from "@/shared/config";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { code: "csrf" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  const body = await request.text();
  if (body.length > inputLimits.canonicalSourceBytes)
    return NextResponse.json({ code: "too-large" }, { status: 413 });
  try {
    const parsed: unknown = JSON.parse(body);
    const object =
      parsed && typeof parsed === "object"
        ? (parsed as { source?: unknown })
        : {};
    const source = datasetSchema.safeParse(object.source).success
      ? datasetSchema.parse(object.source)
      : textSourceSchema.parse(object.source);
    const report = await analyzeSource(source);
    return NextResponse.json(
      { report },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const code = error instanceof AnalysisError ? error.code : "invalid-source";
    return NextResponse.json(
      { code },
      {
        status: code === "unavailable" ? 503 : 422,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
