import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logAudit, auditRequestInfo } from "@/lib/audit";

/* ── PATCH — revoke a pending invitation ── */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    // Verify ownership and that it's still pending
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: params.id,
        coachId: coach.id,
        status: "PENDING",
      },
    });
    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found or already resolved." },
        { status: 404 }
      );
    }

    await prisma.invitation.update({
      where: { id: params.id },
      data: { status: "REVOKED" },
    });

    void logAudit({
      userId: session.userId,
      action: "INVITATION_REVOKED",
      resource: `invitation:${params.id}`,
      metadata: { email: invitation.email, coachId: coach.id },
      ...auditRequestInfo(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("PATCH /api/invitations/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to revoke invitation." }, { status: 500 });
  }
}
