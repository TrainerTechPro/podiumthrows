import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFlags } from "@/lib/flags";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/flags — Read all feature flags (admin only)
 */
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  // Re-verify isAdmin from DB (JWT claim could be stale after revocation)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const flags = await getFlags();
  return NextResponse.json({ success: true, data: { flags } });
}
