import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createOverride } from "@/lib/data/programming";

/* ─── POST — create a tier override for a programmed session ─────────────── */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { throwsSessionId, tier, groupId, athleteId } = body as Record<string, unknown>;

    if (typeof throwsSessionId !== "string" || !throwsSessionId.trim()) {
      return NextResponse.json({ error: "throwsSessionId is required." }, { status: 400 });
    }
    if (tier !== "GROUP" && tier !== "INDIVIDUAL") {
      return NextResponse.json({ error: "tier must be 'GROUP' or 'INDIVIDUAL'." }, { status: 400 });
    }
    if (tier === "GROUP" && typeof groupId !== "string") {
      return NextResponse.json(
        { error: "groupId is required for GROUP overrides." },
        { status: 400 }
      );
    }
    if (tier === "INDIVIDUAL" && typeof athleteId !== "string") {
      return NextResponse.json(
        { error: "athleteId is required for INDIVIDUAL overrides." },
        { status: 400 }
      );
    }

    const data = await createOverride(params.id, coach.id, {
      throwsSessionId: throwsSessionId as string,
      tier: tier as "GROUP" | "INDIVIDUAL",
      groupId: typeof groupId === "string" ? groupId : undefined,
      athleteId: typeof athleteId === "string" ? athleteId : undefined,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("[programming override POST]", err);
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
