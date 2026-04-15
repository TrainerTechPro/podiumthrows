import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { hashInvitationToken } from "@/lib/invitation-token";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token: hashInvitationToken(token) },
      include: {
        athleteProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            events: true,
          },
        },
        coach: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: "Invalid invite token" }, { status: 404 });
    }

    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        { success: false, error: "This invite has already been used." },
        { status: 410 }
      );
    }

    if (invitation.status === "REVOKED") {
      return NextResponse.json(
        { success: false, error: "This invite has been revoked." },
        { status: 410 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invite has expired. Ask your coach to send a new one." },
        { status: 410 }
      );
    }

    // Note: `token` is intentionally excluded from the response. The caller
    // already has the raw token (they passed it in the query string); echoing
    // it back would be a needless extra exposure.
    return NextResponse.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        athleteProfile: invitation.athleteProfile ?? null,
        coachName: `${invitation.coach.firstName} ${invitation.coach.lastName}`,
      },
    });
  } catch (error) {
    logger.error("Error verifying invitation", { context: "api", error });
    return NextResponse.json(
      { success: false, error: "Failed to verify invitation" },
      { status: 500 }
    );
  }
}
