import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST — Convert a self-program ProgramSession into a ThrowsAssignment
 * and redirect the athlete to the live workout view.
 *
 * Creates: ThrowsSession + ThrowsBlocks + ThrowsAssignment
 * Returns: { assignmentId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const { id: configId, sessionId } = await params;

    // Verify config ownership
    const config = await prisma.selfProgramConfig.findUnique({
      where: { id: configId },
      select: { athleteProfileId: true, event: true },
    });
    if (!config || config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Not your program" }, { status: 403 });
    }

    // Load the program session
    const programSession = await prisma.programSession.findUnique({
      where: { id: sessionId },
      include: {
        program: { select: { event: true } },
        phase: { select: { phase: true } },
      },
    });
    if (!programSession) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Prevent re-starting completed/skipped sessions
    if (programSession.status === "COMPLETED" || programSession.status === "SKIPPED") {
      return NextResponse.json(
        { success: false, error: "Session already completed or skipped" },
        { status: 409 }
      );
    }

    // Check if an assignment already exists for this session (idempotent)
    const existingSession = await prisma.throwsSession.findFirst({
      where: {
        coachId: athlete.coachId,
        tags: { contains: `selfProgram:${sessionId}` },
      },
      include: { assignments: { where: { athleteId: athlete.id }, select: { id: true } } },
    });

    if (existingSession?.assignments[0]) {
      // Already created — just return the existing assignment
      return NextResponse.json({
        success: true,
        data: { assignmentId: existingSession.assignments[0].id },
      });
    }

    // Parse prescriptions
    const throwsPrescription = JSON.parse(programSession.throwsPrescription || "[]") as Array<{
      implement: string;
      implementKg: number;
      category: string;
      drillType: string;
      sets: number;
      repsPerSet: number;
      restSeconds: number;
      notes?: string;
    }>;

    const strengthPrescription = programSession.strengthPrescription
      ? (JSON.parse(programSession.strengthPrescription) as Array<{
          exerciseName: string;
          classification: string;
          sets: number;
          reps: number;
          intensityPercent?: number;
          loadKg?: number;
          restSeconds: number;
          notes?: string;
        }>)
      : [];

    const warmupPrescription = programSession.warmupPrescription
      ? (JSON.parse(programSession.warmupPrescription) as Array<{
          name: string;
          duration?: number;
          notes?: string;
        }>)
      : [];

    // Build blocks
    const blocks: Array<{
      blockType: "WARMUP" | "THROWING" | "STRENGTH";
      position: number;
      config: string;
    }> = [];
    let position = 0;

    // Warmup blocks
    if (warmupPrescription.length > 0) {
      blocks.push({
        blockType: "WARMUP",
        position: position++,
        config: JSON.stringify({
          drills: warmupPrescription.map((w) => ({
            name: w.name,
            duration: w.duration ?? 5,
            notes: w.notes,
          })),
          totalDuration: warmupPrescription.reduce((s, w) => s + (w.duration ?? 5), 0),
        }),
      });
    }

    // Interleave throwing and strength blocks per Bondarchuk methodology:
    // Throwing Block 1 → Strength Block → Throwing Block 2 → Strength Block
    // Never two consecutive throwing blocks.
    const throwBlocks = throwsPrescription.map((tp) => ({
      blockType: "THROWING" as const,
      config: JSON.stringify({
        exerciseName: `${tp.implement} ${tp.drillType}`.trim(),
        implement: tp.implement,
        implementWeightKg: tp.implementKg,
        classification: tp.category,
        drillType: tp.drillType,
        throwCount: tp.sets * tp.repsPerSet,
        sets: tp.sets,
        repsPerSet: tp.repsPerSet,
        restSeconds: tp.restSeconds,
        notes: tp.notes,
      }),
    }));

    const strengthBlocks = strengthPrescription.map((sp) => ({
      blockType: "STRENGTH" as const,
      config: JSON.stringify({
        exerciseName: sp.exerciseName,
        classification: sp.classification,
        sets: sp.sets,
        reps: sp.reps,
        intensityPercent: sp.intensityPercent,
        loadKg: sp.loadKg,
        restSeconds: sp.restSeconds,
        notes: sp.notes,
      }),
    }));

    // Interleave: throw, strength, throw, strength, ... then remaining
    const maxLen = Math.max(throwBlocks.length, strengthBlocks.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < throwBlocks.length) {
        blocks.push({ ...throwBlocks[i], position: position++ });
      }
      if (i < strengthBlocks.length) {
        blocks.push({ ...strengthBlocks[i], position: position++ });
      }
    }

    // Create ThrowsSession + ThrowsBlocks + ThrowsAssignment in a transaction
    const today = new Date().toISOString().slice(0, 10);
    const event = programSession.program.event;
    const sessionName = `${programSession.focusLabel} — Self Program`;

    const result = await prisma.$transaction(async (tx) => {
      // Create session
      const throwsSession = await tx.throwsSession.create({
        data: {
          coachId: athlete.coachId,
          name: sessionName,
          sessionType: programSession.sessionType,
          targetPhase: programSession.phase.phase,
          event,
          estimatedDuration: programSession.estimatedDuration,
          tags: JSON.stringify([`selfProgram:${sessionId}`]),
          notes: `Auto-created from self-program session ${sessionId}`,
          blocks: {
            create: blocks,
          },
        },
        include: { blocks: { select: { id: true } } },
      });

      // Create assignment
      const assignment = await tx.throwsAssignment.create({
        data: {
          sessionId: throwsSession.id,
          athleteId: athlete.id,
          assignedDate: today,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      // Mark the ProgramSession as IN_PROGRESS
      await tx.programSession.update({
        where: { id: sessionId },
        data: { status: "IN_PROGRESS" },
      });

      return assignment;
    });

    return NextResponse.json({ success: true, data: { assignmentId: result.id } }, { status: 201 });
  } catch (error) {
    logger.error("Couldn’t start live workout from self-program", {
      context: "api",
      error,
    });
    return NextResponse.json({ success: false, error: "Couldn’t start workout" }, { status: 500 });
  }
}
