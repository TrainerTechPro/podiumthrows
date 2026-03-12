import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/upgrade
 * Admin-only: set a user's plan + isAdmin flag.
 * Body: { email: string, plan?: "FREE"|"PRO"|"ELITE", isAdmin?: boolean }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check isAdmin on the actual DB record (not just token)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, plan, isAdmin } = body as {
    email?: string;
    plan?: string;
    isAdmin?: boolean;
  };

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const results: Record<string, unknown> = {};

  // Update plan on coach profile
  if (plan && ["FREE", "PRO", "ELITE"].includes(plan)) {
    const coach = await prisma.coachProfile.findFirst({
      where: { userId: target.id },
      select: { id: true },
    });
    if (coach) {
      await prisma.coachProfile.update({
        where: { id: coach.id },
        data: { plan: plan as "FREE" | "PRO" | "ELITE" },
      });
      results.plan = plan;
    }
  }

  // Update isAdmin
  if (typeof isAdmin === "boolean") {
    await prisma.user.update({
      where: { id: target.id },
      data: { isAdmin },
    });
    results.isAdmin = isAdmin;
  }

  return NextResponse.json({ success: true, email, results });
}
