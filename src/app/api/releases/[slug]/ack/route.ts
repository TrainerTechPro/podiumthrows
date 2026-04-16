import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/releases/[slug]/ack
 *
 * Records that this user has seen the given release by writing the slug
 * to User.lastSeenReleaseSlug. Idempotent — repeated POSTs with the same
 * slug are no-ops. Validates the slug exists in the Release table so a
 * malicious client can't write an arbitrary value.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const release = await prisma.release.findUnique({
      where: { slug },
      select: { slug: true },
    });
    if (!release) {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { lastSeenReleaseSlug: release.slug },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("POST /api/releases/[slug]/ack", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge release" },
      { status: 500 }
    );
  }
}
