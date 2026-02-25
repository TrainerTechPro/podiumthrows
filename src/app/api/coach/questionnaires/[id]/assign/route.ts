import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify questionnaire ownership and published status
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true, status: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }
    if (questionnaire.status !== "published") {
      return NextResponse.json(
        { error: "Questionnaire must be published before assigning" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { athleteIds } = body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json(
        { error: "At least one athlete ID is required" },
        { status: 400 }
      );
    }

    // Verify all athletes belong to this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });

    const validIds = new Set(athletes.map((a) => a.id));
    const invalidIds = athleteIds.filter((id: string) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Athletes not found: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Create assignments, skipping duplicates
    const results = await Promise.allSettled(
      athleteIds.map((athleteId: string) =>
        prisma.questionnaireAssignment.create({
          data: {
            questionnaireId: params.id,
            athleteId,
          },
        })
      )
    );

    const created = results.filter((r) => r.status === "fulfilled").length;
    const skipped = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      assigned: created,
      skipped,
      total: athleteIds.length,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
