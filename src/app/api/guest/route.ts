import { NextResponse } from "next/server";
import {
  clearGuestSession,
  readGuestWorkspace,
} from "@/entities/guest-workspace";
import { deleteAnalysisWorkspace } from "@/features/analyze-data/server";
import { hasSafeAnalysisRuntime } from "@/shared/config";

export async function DELETE() {
  if (!hasSafeAnalysisRuntime())
    return NextResponse.json(
      { code: "unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  const workspace = await readGuestWorkspace();
  if (!workspace)
    return NextResponse.json(
      { code: "expired" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  await deleteAnalysisWorkspace(workspace.id);
  await clearGuestSession();
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}
