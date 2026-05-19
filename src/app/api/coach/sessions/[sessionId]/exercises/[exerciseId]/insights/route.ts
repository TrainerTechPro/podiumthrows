import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * Coach mobile Exercise Inspector — insights for one prescribed exercise on
 * one session. Returns the same shape the desktop right-rail consumes plus
 * the per-implement history sparkline (last six sessions where this athlete
 * threw at this implement weight).
 *
 * Auth: COACH role; coach must own the athlete; the exercise must belong to
 * the named session's plan. The check is structural — we never look up an
 * exercise outside the session+athlete context the request claims.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; exerciseId: string }> }
) {
  try {
    const { sessionId, exerciseId } = await params;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) {
      return NextResponse.json(
        { success: false, error: "athleteId query param is required" },
        { status: 400 }
      );
    }

    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findFirst({
      where: {
        id: sessionId,
        athleteId,
        athlete: { coachId: coach.id },
      },
      select: {
        id: true,
        planId: true,
        athlete: { select: { firstName: true } },
      },
    });
    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const blockExercise = trainingSession.planId
      ? await prisma.blockExercise.findFirst({
          where: { id: exerciseId, block: { planId: trainingSession.planId } },
          select: {
            id: true,
            sets: true,
            reps: true,
            rpe: true,
            notes: true,
            implementKg: true,
            restSeconds: true,
            block: {
              select: {
                name: true,
                blockType: true,
                restSeconds: true,
              },
            },
            exercise: {
              select: {
                name: true,
                correlationData: true,
              },
            },
          },
        })
      : null;
    if (!blockExercise) {
      return NextResponse.json(
        { success: false, error: "Exercise not found in this session." },
        { status: 404 }
      );
    }

    // History sparkline — last six sessions where this athlete threw at the
    // prescribed implement weight, plus the current session if it's there.
    // We keep the best distance per session and order chronologically.
    const history =
      blockExercise.implementKg != null
        ? await buildHistory({
            athleteId,
            implementKg: blockExercise.implementKg,
            contextSessionId: sessionId,
          })
        : [];

    const lastNote = await prisma.coachNote.findFirst({
      where: { athleteProfileId: athleteId },
      orderBy: { createdAt: "desc" },
      select: {
        content: true,
        createdAt: true,
        coach: { select: { firstName: true, lastName: true } },
      },
    });

    const restSeconds = blockExercise.restSeconds ?? blockExercise.block.restSeconds ?? null;

    return NextResponse.json({
      success: true,
      data: {
        exercise: {
          name: blockExercise.exercise.name,
          implementKg: blockExercise.implementKg,
        },
        laneName: blockExercise.block.name,
        athleteFirstName: trainingSession.athlete.firstName,
        correlation: parseCorrelation(blockExercise.exercise.correlationData),
        prescribed: {
          throws: blockExercise.sets ?? null,
          targetRpe: blockExercise.rpe ?? null,
          rest: restSeconds != null ? formatRestLabel(restSeconds) : null,
          cueFocus: blockExercise.notes ?? null,
        },
        history,
        lastNote: lastNote
          ? {
              quote: lastNote.content.trim(),
              authorLabel: `COACH ${lastNote.coach.lastName.toUpperCase()} · ${formatShortDate(
                lastNote.createdAt
              )}`,
            }
          : null,
        citations: [
          { label: "Vol IV · p.114-117", href: null },
          { label: "Comp seq study · 2019", href: null },
        ],
      },
    });
  } catch (err) {
    logger.error("GET /api/coach/sessions/[sessionId]/exercises/[exerciseId]/insights", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t load insights." },
      { status: 500 }
    );
  }
}

async function buildHistory(args: {
  athleteId: string;
  implementKg: number;
  contextSessionId: string;
}): Promise<Array<{ date: string; label: string; distance: number; isCurrent: boolean }>> {
  const { athleteId, implementKg, contextSessionId } = args;

  // Pull a generous slice — the most recent 100 throws at this implement —
  // then collapse to one row per session (best distance) and keep the latest
  // six. Ensures the current session is captured even if it has many throws.
  const throws = await prisma.throwLog.findMany({
    where: {
      athleteId,
      implementWeight: implementKg,
      distance: { not: null },
    },
    orderBy: { date: "desc" },
    take: 100,
    select: {
      sessionId: true,
      distance: true,
      date: true,
    },
  });

  type Row = { sessionId: string | null; date: Date; distance: number };
  const bestPerSession = new Map<string, Row>();
  for (const t of throws) {
    if (t.distance == null) continue;
    const key = t.sessionId ?? `__date_${t.date.toISOString().slice(0, 10)}`;
    const cur = bestPerSession.get(key);
    if (!cur || t.distance > cur.distance) {
      bestPerSession.set(key, { sessionId: t.sessionId, date: t.date, distance: t.distance });
    }
  }

  const rows = Array.from(bestPerSession.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6)
    .reverse(); // chronological for the sparkline

  return rows.map((r) => ({
    date: r.date.toISOString(),
    label: formatShortDate(r.date),
    distance: r.distance,
    isCurrent: r.sessionId === contextSessionId,
  }));
}

function parseCorrelation(raw: unknown): {
  coefficient: number;
  sampleSize: number | null;
  population: string | null;
  band: "LOW" | "MEDIUM" | "HIGH";
} | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { coefficient?: number; n?: number; population?: string };
  if (typeof data.coefficient !== "number") return null;
  const c = Math.max(0, Math.min(1, data.coefficient));
  const band: "LOW" | "MEDIUM" | "HIGH" = c >= 0.7 ? "HIGH" : c >= 0.4 ? "MEDIUM" : "LOW";
  return {
    coefficient: c,
    sampleSize: typeof data.n === "number" ? data.n : null,
    population: typeof data.population === "string" ? data.population : null,
    band,
  };
}

function formatRestLabel(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
