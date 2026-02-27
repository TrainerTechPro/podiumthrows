import { NextRequest, NextResponse } from "next/server";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { athlete } = await requireAthleteSession();

    const body = await req.json();
    const { draftAnswers } = body;

    if (!draftAnswers || typeof draftAnswers !== "object") {
      return NextResponse.json(
        { error: "Invalid draft data" },
        { status: 400 }
      );
    }

    // Find the most recent uncompleted assignment
    const assignment = await prisma.questionnaireAssignment.findFirst({
      where: {
        questionnaireId: params.id,
        athleteId: athlete.id,
        completedAt: null,
      },
      orderBy: { assignedAt: "desc" },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "No active assignment found" },
        { status: 404 }
      );
    }

    await prisma.questionnaireAssignment.update({
      where: { id: assignment.id },
      data: { draftAnswers },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
