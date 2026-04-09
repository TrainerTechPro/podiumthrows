import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFlags } from "@/lib/flags";

/**
 * GET /api/admin/flags — Read all feature flags (admin only)
 */
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const flags = await getFlags();
  return NextResponse.json({ success: true, data: { flags } });
}
