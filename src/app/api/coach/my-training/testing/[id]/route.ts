import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const record = await prisma.coachTestingRecord.findUnique({
      where: { id: params.id },
      select: { coachId: true },
    });

    if (!record || record.coachId !== coach.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.coachTestingRecord.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("DELETE /api/coach/my-training/testing/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
