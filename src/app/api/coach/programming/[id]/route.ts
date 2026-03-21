import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateProgrammedSession, deleteProgrammedSession } from "@/lib/data/programming";

/* ─── PUT — update a programmed session ─────────────────────────────────── */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
    const { title, throwsSessionId, notes, scheduledDate } = body as Record<string, unknown>;

    const data = await updateProgrammedSession(params.id, coach.id, {
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof throwsSessionId === "string" ? { throwsSessionId } : {}),
      ...(typeof notes === "string" ? { notes } : {}),
      ...(typeof scheduledDate === "string" ? { scheduledDate } : {}),
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[programming PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─── DELETE — remove a programmed session ───────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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

    await deleteProgrammedSession(params.id, coach.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[programming DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
