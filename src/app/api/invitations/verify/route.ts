import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
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
      return NextResponse.json({ ok: false, error: "Invalid invite token" }, { status: 404 });
    }

    if (invitation.status === "ACCEPTED") {
      return NextResponse.json({ ok: false, error: "This invite has already been used." }, { status: 410 });
    }

    if (invitation.status === "REVOKED") {
      return NextResponse.json({ ok: false, error: "This invite has been revoked." }, { status: 410 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: "This invite has expired. Ask your coach to send a new one." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        invitation: {
          id: invitation.id,
          token: invitation.token,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        athleteProfile: invitation.athleteProfile ?? null,
        coachName: `${invitation.coach.firstName} ${invitation.coach.lastName}`,
      },
    });
  } catch (error) {
    console.error("Error verifying invitation:", error);
    return NextResponse.json({ ok: false, error: "Failed to verify invitation" }, { status: 500 });
  }
}
