/**
 * Quick Log API — one-tap throw logger for athletes at practice.
 *
 * GET  — current state (today's session, recent throws, throw count, available implements)
 * POST — log a new throw (creates AthleteThrowsSession if needed, creates ThrowLog)
 * PATCH — edit an existing throw
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkAndSetPR, COMPETITION_WEIGHTS, IMPLEMENT_PRESETS } from "@/lib/throws";
import { updateThrowsStreak } from "@/lib/streak";
import { emitPR } from "@/lib/team-activity";
import { logger } from "@/lib/logger";
import { resolveTimezone, getLocalDate, startOfToday as startOfTodayForTz } from "@/lib/dates";
// EventType enum import removed — DB column is TEXT, not the enum type

// ── Types ────────────────────────────────────────────────────────────────────

type Feeling = "bad" | "ok" | "great";

interface QuickLogNotes {
  feeling?: Feeling;
  text?: string;
}

interface ImplementOption {
  event: string;
  implementWeight: number;
  label: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeNotes(feeling?: Feeling | null, text?: string | null): string | null {
  if (!feeling && !text) return null;
  const obj: QuickLogNotes = {};
  if (feeling) obj.feeling = feeling;
  if (text) obj.text = text;
  return JSON.stringify(obj);
}

function deserializeNotes(raw: string | null): { feeling: Feeling | null; text: string | null } {
  if (!raw) return { feeling: null, text: null };
  try {
    const parsed = JSON.parse(raw) as QuickLogNotes;
    return {
      feeling: (parsed.feeling as Feeling) ?? null,
      text: parsed.text ?? null,
    };
  } catch {
    // Legacy plain-text note — return as text
    return { feeling: null, text: raw };
  }
}

function formatWeight(weightKg: number, event: string): string {
  // Show whole numbers cleanly: 7.26 → "7.26kg", 2 → "2kg"
  const display = parseFloat(weightKg.toFixed(2));
  const eventLabel: Record<string, string> = {
    SHOT_PUT: "Shot Put",
    DISCUS: "Discus",
    HAMMER: "Hammer",
    JAVELIN: "Javelin",
  };
  return `${eventLabel[event] ?? event} ${display}kg`;
}

/** Build the available implements list for an athlete (competition weight per event). */
function buildAvailableImplements(
  events: string[],
  gender: string
): ImplementOption[] {
  const genderKey = gender === "FEMALE" ? "female" : "male";
  return events.map((event) => {
    const implementWeight = COMPETITION_WEIGHTS[event]?.[genderKey] ?? 0;
    return {
      event,
      implementWeight,
      label: formatWeight(implementWeight, event),
    };
  });
}

/** Get the most recently used implement for an athlete, or fall back to competition weight. */
async function getCurrentImplement(
  athleteId: string,
  primaryEvent: string,
  gender: string
): Promise<ImplementOption> {
  const recent = await prisma.throwLog.findFirst({
    where: { athleteId },
    orderBy: { date: "desc" },
    select: { event: true, implementWeight: true },
  });

  if (recent) {
    return {
      event: recent.event as string,
      implementWeight: recent.implementWeight,
      label: formatWeight(recent.implementWeight, recent.event as string),
    };
  }

  const genderKey = gender === "FEMALE" ? "female" : "male";
  const implementWeight = COMPETITION_WEIGHTS[primaryEvent]?.[genderKey] ?? 0;
  return {
    event: primaryEvent,
    implementWeight,
    label: formatWeight(implementWeight, primaryEvent),
  };
}

// ── GET — current Quick Log state ─────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, gender: true, events: true, timezone: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const tz = resolveTimezone(athlete.timezone);
    const today = getLocalDate(tz);
    const startOfTodayUtc = startOfTodayForTz(tz);

    const events = athlete.events as string[];
    const primaryEvent = events[0] ?? "SHOT_PUT";
    const gender = athlete.gender as string;

    // Today's AthleteThrowsSession (most recent for primary event)
    const todaySession = await prisma.athleteThrowsSession.findFirst({
      where: { athleteId: athlete.id, date: today },
      orderBy: { createdAt: "desc" },
      select: { id: true, event: true, date: true, focus: true },
    });

    // Last 3 ThrowLogs today
    const recentThrowsRaw = await prisma.throwLog.findMany({
      where: {
        athleteId: athlete.id,
        date: { gte: startOfTodayUtc },
      },
      orderBy: { date: "desc" },
      take: 3,
      select: { id: true, event: true, implementWeight: true, distance: true, notes: true, date: true },
    });

    const recentThrows = recentThrowsRaw.map((t) => {
      const { feeling, text } = deserializeNotes(t.notes);
      return {
        id: t.id,
        event: t.event as string,
        implementWeight: t.implementWeight,
        distance: t.distance ?? null,
        feeling,
        notes: text,
        createdAt: t.date.toISOString(),
      };
    });

    // Total throw count today
    const throwCount = await prisma.throwLog.count({
      where: {
        athleteId: athlete.id,
        date: { gte: startOfTodayUtc },
      },
    });

    const currentImplement = await getCurrentImplement(athlete.id, primaryEvent, gender);
    const availableImplements = buildAvailableImplements(events, gender);

    // Weight presets per event for the implement weight picker
    const genderKey = gender === "FEMALE" ? "female" : "male";
    const weightPresets: Record<string, number[]> = {};
    for (const ev of events) {
      weightPresets[ev] = IMPLEMENT_PRESETS[ev]?.[genderKey] ?? [];
    }

    // Competition weights per event for highlighting
    const compWeights: Record<string, number> = {};
    for (const ev of events) {
      compWeights[ev] = COMPETITION_WEIGHTS[ev]?.[genderKey] ?? 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        session: todaySession
          ? { id: todaySession.id, event: todaySession.event, date: todaySession.date }
          : null,
        currentImplement,
        recentThrows,
        throwCount,
        availableImplements,
        weightPresets,
        compWeights,
        sessionFocus: todaySession?.focus ?? null,
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/quick-log", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to load quick-log state." },
      { status: 500 }
    );
  }
}

// ── POST — log a new throw ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true, gender: true, events: true, timezone: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const tz = resolveTimezone(athlete.timezone);
    const today = getLocalDate(tz);
    const startOfTodayUtc = startOfTodayForTz(tz);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { event, implementWeight, distance, feeling, notes } = body;

    // Validate required fields
    if (typeof event !== "string" || !["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"].includes(event)) {
      return NextResponse.json({ success: false, error: "Invalid event" }, { status: 400 });
    }
    if (typeof implementWeight !== "number" || implementWeight <= 0) {
      return NextResponse.json({ success: false, error: "Invalid implementWeight" }, { status: 400 });
    }
    if (distance !== undefined && distance !== null && typeof distance !== "number") {
      return NextResponse.json({ success: false, error: "distance must be a number if provided" }, { status: 400 });
    }
    if (feeling !== undefined && feeling !== null && !["bad", "ok", "great"].includes(feeling as string)) {
      return NextResponse.json({ success: false, error: "feeling must be 'bad', 'ok', or 'great'" }, { status: 400 });
    }

    const distanceNum = typeof distance === "number" ? distance : null;
    const feelingVal = typeof feeling === "string" ? (feeling as Feeling) : null;
    const notesText = typeof notes === "string" ? notes.trim() || null : null;

    // 1. Find or create today's AthleteThrowsSession for this event
    // Note: the DB column is TEXT (from initial migration), not the EventType enum.
    // Using `as never` to bypass Prisma's type check while sending a plain string.
    let throwsSession = await prisma.athleteThrowsSession.findFirst({
      where: { athleteId: athlete.id, date: today, event: event as never },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!throwsSession) {
      throwsSession = await prisma.athleteThrowsSession.create({
        data: {
          athleteId: athlete.id,
          event: event as never,
          date: today,
          focus: "Quick Log",
        },
        select: { id: true },
      });
    }

    // 2. Create ThrowLog — sessionId is left null (Quick Log is standalone from TrainingSession)
    const serializedNotes = serializeNotes(feelingVal, notesText);

    const throwLog = await prisma.throwLog.create({
      data: {
        athleteId: athlete.id,
        sessionId: null,
        event: event as never,
        implementWeight,
        implementWeightUnit: "kg",
        distance: distanceNum,
        date: new Date(),
        isPersonalBest: false,
        notes: serializedNotes,
      },
      select: { id: true, distance: true, notes: true, isPersonalBest: true, date: true },
    });

    // 3. PR detection — only when distance is provided
    let isPersonalBest = false;
    if (distanceNum != null && distanceNum > 0) {
      // Capture the previous best distance BEFORE checkAndSetPR runs so
      // the team feed row can show the delta. checkAndSetPR unmarks the
      // old PR when a new one is set, so we have to read first.
      const priorBest = await prisma.throwLog.findFirst({
        where: {
          athleteId: athlete.id,
          event: event as never,
          implementWeight,
          isPersonalBest: true,
        },
        select: { distance: true },
      });

      const prResult = await checkAndSetPR(athlete.id, event, implementWeight, distanceNum);
      isPersonalBest = prResult.isPersonalBest;

      if (isPersonalBest) {
        await prisma.throwLog.update({
          where: { id: throwLog.id },
          data: { isPersonalBest: true },
        });

        // Fire-and-forget team feed emission. Swallowed errors cannot
        // break the throw-log response.
        void emitPR(athlete.id, {
          event,
          implementWeight,
          distance: distanceNum,
          previousDistance: priorBest?.distance ?? null,
        }).catch(() => null);
      }
    }

    // 4. Update the throws-based streak — fire-and-forget so it never
    // crashes the response. The throw is already persisted above.
    void updateThrowsStreak(athlete.id).catch((err) => {
      logger.error("POST /api/athlete/quick-log streak update failed (non-fatal)", { error: err });
    });

    // 5. Get updated throw count for today
    let throwCount = 0;
    try {
      throwCount = await prisma.throwLog.count({
        where: {
          athleteId: athlete.id,
          date: { gte: startOfTodayUtc },
        },
      });
    } catch {
      // Fall back to optimistic count — the throw IS saved, just can't get the count
      throwCount = -1; // client will use its own count
    }

    const { feeling: parsedFeeling, text: parsedText } = deserializeNotes(throwLog.notes);

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({
      success: true,
      data: {
        throw: {
          id: throwLog.id,
          distance: throwLog.distance,
          feeling: parsedFeeling,
          notes: parsedText,
          isPersonalBest,
          createdAt: throwLog.date.toISOString(),
        },
        throwCount,
        sessionId: throwsSession.id,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("POST /api/athlete/quick-log", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: `Failed to log throw: ${errMsg}` },
      { status: 500 }
    );
  }
}

// ── PATCH — edit an existing throw ───────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { id, distance, feeling, notes } = body;

    if (typeof id !== "string") {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    // Find and verify ownership
    const existing = await prisma.throwLog.findUnique({
      where: { id },
      select: { id: true, athleteId: true, event: true, implementWeight: true, distance: true, notes: true, isPersonalBest: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }
    if (existing.athleteId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Validate incoming fields
    if (distance !== undefined && distance !== null && typeof distance !== "number") {
      return NextResponse.json({ success: false, error: "distance must be a number if provided" }, { status: 400 });
    }
    if (feeling !== undefined && feeling !== null && !["bad", "ok", "great"].includes(feeling as string)) {
      return NextResponse.json({ success: false, error: "feeling must be 'bad', 'ok', or 'great'" }, { status: 400 });
    }

    const newDistance = distance === null ? null : typeof distance === "number" ? distance : existing.distance;
    const newFeeling = feeling === null ? null : typeof feeling === "string" ? (feeling as Feeling) : null;
    const newNotesText = notes === null ? null : typeof notes === "string" ? notes.trim() || null : null;

    // Re-parse existing notes to preserve feeling if only text changes (and vice versa)
    const prevParsed = deserializeNotes(existing.notes);
    const resolvedFeeling = feeling !== undefined ? newFeeling : prevParsed.feeling;
    const resolvedText = notes !== undefined ? newNotesText : prevParsed.text;
    const serializedNotes = serializeNotes(resolvedFeeling, resolvedText);

    // Determine if we need to re-run PR detection
    const distanceChanged = newDistance !== existing.distance;

    const updated = await prisma.throwLog.update({
      where: { id },
      data: {
        distance: newDistance,
        notes: serializedNotes,
        // Reset PR flag if distance is being cleared
        ...(newDistance == null ? { isPersonalBest: false } : {}),
      },
      select: { id: true, distance: true, notes: true, isPersonalBest: true, date: true },
    });

    // Re-run PR detection if distance changed and is now a positive number
    let isPersonalBest = updated.isPersonalBest;
    if (distanceChanged && newDistance != null && newDistance > 0) {
      const prResult = await checkAndSetPR(athlete.id, existing.event as string, existing.implementWeight, newDistance);
      isPersonalBest = prResult.isPersonalBest;
      if (isPersonalBest !== updated.isPersonalBest) {
        await prisma.throwLog.update({
          where: { id },
          data: { isPersonalBest },
        });
      }
    }

    const { feeling: parsedFeeling, text: parsedText } = deserializeNotes(updated.notes);

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${athlete.id}`);
    if (athlete.coachId) revalidateTag(`coach-${athlete.coachId}`);

    return NextResponse.json({
      success: true,
      data: {
        throw: {
          id: updated.id,
          distance: updated.distance,
          feeling: parsedFeeling,
          notes: parsedText,
          isPersonalBest,
          createdAt: updated.date.toISOString(),
        },
      },
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/quick-log", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update throw." },
      { status: 500 }
    );
  }
}
