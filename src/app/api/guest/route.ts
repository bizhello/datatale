import { NextResponse } from "next/server";
import { guestWorkspaceSchema } from "@/entities/guest-workspace";

export async function DELETE() {
  // The production repository deletion is deliberately unavailable without a
  // valid sealed workspace session; this endpoint never accepts an owner ID.
  void guestWorkspaceSchema;
  return NextResponse.json(
    { code: "unavailable" },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
