import { NextResponse } from "next/server";
import { hasSafeAnalysisRuntime } from "@/shared/config";

export async function GET(request: Request) {
  if (
    !hasSafeAnalysisRuntime() ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  }
  // Repository cleanup is intentionally invoked only from an authenticated cron.
  return NextResponse.json(
    { deleted: 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
