import { NextResponse } from "next/server";
import { cleanupAnalysisGate } from "@/features/analyze-data/server";
import { hasSafeAnalysisRuntime } from "@/shared/config";

export async function GET(request: Request) {
  if (
    !hasSafeAnalysisRuntime() ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  }
  const deleted = await cleanupAnalysisGate();
  return NextResponse.json(
    { deleted },
    { headers: { "Cache-Control": "no-store" } },
  );
}
