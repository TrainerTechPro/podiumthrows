import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { markAsRead } from "@/lib/notifications";
import { logger } from "@/lib/logger";

type RouteContext = { params: { id: string } };

/* ─── PATCH — mark a single notification read/unread ─────────────────────── */

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve profile ID
    let profileId: string | null = null;
    if (session.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      profileId = coach?.id ?? null;
    } else {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      profileId = athlete?.id ?? null;
    }

    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { read } = body as Record<string, unknown>;
    const readValue = typeof read === "boolean" ? read : true;

    const updated = await markAsRead(params.id, profileId, session.role, readValue);
    if (!updated) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/notifications/[id]", { context: "api", metadata: { error: String(err) } });
    return NextResponse.json({ error: "Failed to update notification." }, { status: 500 });
  }
}
