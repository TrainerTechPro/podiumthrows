import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        coachProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            bio: true,
            organization: true,
            avatarUrl: true,
            plan: true,
          },
        },
        athleteProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            events: true,
            gender: true,
            dateOfBirth: true,
            avatarUrl: true,
            currentStreak: true,
            longestStreak: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
