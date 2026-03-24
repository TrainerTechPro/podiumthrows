import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";

/* ─── GET — lightweight unread count for badge polling ───────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ count: 0 }, { status: 401 });
    }

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
      return NextResponse.json({ count: 0 });
    }

    const count = await getUnreadCount(profileId, session.role);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
