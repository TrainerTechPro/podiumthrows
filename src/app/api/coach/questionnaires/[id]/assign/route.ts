import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { notifyAthleteQuestionnaireAssigned } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    // Verify questionnaire ownership and published status
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true, status: true, title: true },
    });

    if (!questionnaire) {
      return NextResponse.json(
        { success: false, error: "Questionnaire not found" },
        { status: 404 }
      );
    }
    if (questionnaire.status !== "published") {
      return NextResponse.json(
        { success: false, error: "Questionnaire must be published before assigning" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { athleteIds } = body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one athlete ID is required" },
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
        { success: false, error: `Athletes not found: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Create assignments, skipping duplicates
    const results = await Promise.allSettled(
      athleteIds.map((athleteId: string) =>
        prisma.questionnaireAssignment.create({
          data: {
            questionnaireId: id,
            athleteId,
          },
        })
      )
    );

    const created = results.filter((r) => r.status === "fulfilled").length;
    const skipped = results.filter((r) => r.status === "rejected").length;

    // Fire-and-forget notifications for newly-assigned athletes. Skipped
    // (duplicate) assignments don't re-notify. Per-notification failure
    // must not affect the response.
    const successfulAthleteIds = athleteIds.filter(
      (_id: string, i: number) => results[i].status === "fulfilled"
    );
    Promise.allSettled(
      successfulAthleteIds.map((athleteId: string) =>
        notifyAthleteQuestionnaireAssigned(athleteId, questionnaire.title, id)
      )
    ).catch((err) =>
      logger.error("Couldn’t notify athletes of questionnaire assignment", {
        context: "api",
        error: err,
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        assigned: created,
        skipped,
        total: athleteIds.length,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
