import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { logAudit, auditRequestInfo } from "@/lib/audit";

/* ── PATCH — revoke a pending invitation ── */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error:"Coach not found" }, { status: 404 });
    }

    // Verify ownership and that it's still pending
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: id,
        coachId: coach.id,
        status: "PENDING",
      },
    });
    if (!invitation) {
      return NextResponse.json(
        { success: false, error:"Invitation not found or already resolved." },
        { status: 404 }
      );
    }

    await prisma.invitation.update({
      where: { id: id },
      data: { status: "REVOKED" },
    });

    void logAudit({
      userId: session.userId,
      action: "INVITATION_REVOKED",
      resource: `invitation:${id}`,
      metadata: { email: invitation.email, coachId: coach.id },
      ...auditRequestInfo(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/invitations/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error:"Couldn’t revoke invitation." }, { status: 500 });
  }
}
