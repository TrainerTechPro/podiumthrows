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
import { COMPETITION_WEIGHTS, IMPLEMENT_PRESETS } from "@/lib/throws";
import { recordThrow } from "@/lib/throws/pr";
import { findCatalogMatchForWeight } from "@/lib/implements";
import type { ImplementType } from "@prisma/client";
import { updateThrowsStreak } from "@/lib/streak";
import { emitPR } from "@/lib/team-activity";
import { logger } from "@/lib/logger";
import { resolveTimezone, getLocalDate, startOfToday as startOfTodayForTz } from "@/lib/dates";
import {
  parseBody,
  parseBodyText,
  QuickLogThrowSchema,
  QuickLogEditSchema,
} from "@/lib/api-schemas";
import { withIdempotency } from "@/lib/idempotency";
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
  /// Catalog displayLabel ("16 lb", "7.26 kg", "18 lb · 3/4 wire") when the
  /// preset weight resolves to a catalog row. Client renders this in
  /// preference to the legacy `${kg}kg` label so imperial implements show
  /// as the catalog names them. Null = no catalog match (legacy fallback).
  displayLabel?: string | null;
}

/** EventType (SHOT_PUT) → ImplementType (SHOT). Returns null for unknowns. */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

/**
 * Resolve a (event, kg) pair to the canonical catalog displayLabel.
 * Returns null when there's no catalog row near that weight (very rare —
 * the presets are calibrated to standard catalog weights). Defaults to
 * the metric variant when both metric + imperial rows match the weight
 * (e.g. 7.26 kg matches both "7.26 kg" and "16 lb"); coaches who want
 * imperial labels in quick-log should add an athlete-level preference
 * later — out of scope for this pass.
 */
async function resolveCatalogLabel(event: string, kg: number): Promise<string | null> {
  const throwType = eventToImplementType(event);
  if (!throwType) return null;
  const match = await findCatalogMatchForWeight(kg, throwType, { unitSystem: "metric" });
  if (match.kind === "exact" || match.kind === "tolerated") return match.implement.displayLabel;
  return null;
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
function buildAvailableImplements(events: string[], gender: string): ImplementOption[] {
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

/** Attach catalog displayLabel to an implement option, in place. */
async function enrichWithCatalogLabel(opt: ImplementOption): Promise<ImplementOption> {
  if (opt.implementWeight <= 0) return opt;
  const displayLabel = await resolveCatalogLabel(opt.event, opt.implementWeight);
  return { ...opt, displayLabel };
}

/** Get the most recently used implement for an athlete, or fall back to competition weight. */
async function getCurrentImplement(
  athleteId: string,
  primaryEvent: string,
  gender: string
): Promise<ImplementOption> {
  // Pull the most recent throw — prefer its joined catalog implement when
  // present so the picker label matches what the throw was actually logged
  // against (e.g. "16 lb" instead of "7.26kg" when the athlete throws imperial).
  const recent = await prisma.throwLog.findFirst({
    where: { athleteId },
    orderBy: { date: "desc" },
    select: {
      event: true,
      implementWeight: true,
      implement: { select: { displayLabel: true } },
    },
  });

  if (recent) {
    return {
      event: recent.event as string,
      implementWeight: recent.implementWeight,
      label: formatWeight(recent.implementWeight, recent.event as string),
      displayLabel:
        recent.implement?.displayLabel ??
        (await resolveCatalogLabel(recent.event as string, recent.implementWeight)),
    };
  }

  const genderKey = gender === "FEMALE" ? "female" : "male";
  const implementWeight = COMPETITION_WEIGHTS[primaryEvent]?.[genderKey] ?? 0;
  return {
    event: primaryEvent,
    implementWeight,
    label: formatWeight(implementWeight, primaryEvent),
    displayLabel: await resolveCatalogLabel(primaryEvent, implementWeight),
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
      select: {
        id: true,
        event: true,
        implementWeight: true,
        distance: true,
        notes: true,
        date: true,
        // Joined for canonical catalog label — falls back to "${kg}kg"
        // client-side when the row predates the catalog backfill.
        implement: { select: { displayLabel: true } },
      },
    });

    const recentThrows = recentThrowsRaw.map((t) => {
      const { feeling, text } = deserializeNotes(t.notes);
      return {
        id: t.id,
        event: t.event as string,
        implementWeight: t.implementWeight,
        implementLabel: t.implement?.displayLabel ?? null,
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
    const availableImplements = await Promise.all(
      buildAvailableImplements(events, gender).map(enrichWithCatalogLabel)
    );

    // Weight presets per event for the implement weight picker. Each preset
    // ships with its catalog displayLabel so the pill renders "16 lb" /
    // "7.26 kg" instead of always "${kg}kg".
    const genderKey = gender === "FEMALE" ? "female" : "male";
    const weightPresets: Record<string, number[]> = {};
    const weightPresetLabels: Record<string, Array<{ kg: number; label: string | null }>> = {};
    for (const ev of events) {
      const kgList = IMPLEMENT_PRESETS[ev]?.[genderKey] ?? [];
      weightPresets[ev] = kgList; // legacy field — kept for back-compat
      weightPresetLabels[ev] = await Promise.all(
        kgList.map(async (kg) => ({ kg, label: await resolveCatalogLabel(ev, kg) }))
      );
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
        weightPresetLabels,
        compWeights,
        sessionFocus: todaySession?.focus ?? null,
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/quick-log", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t load quick-log state." },
      { status: 500 }
    );
  }
}

// ── POST — log a new throw ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return withIdempotency(
    { userId: session.userId, endpoint: "/api/athlete/quick-log", req },
    async (bodyText) => postHandler(session.userId, bodyText)
  );
}

async function postHandler(userId: string, bodyText: string): Promise<NextResponse> {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { id: true, coachId: true, gender: true, events: true, timezone: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const tz = resolveTimezone(athlete.timezone);
    const today = getLocalDate(tz);
    const startOfTodayUtc = startOfTodayForTz(tz);

    const parsed = parseBodyText(bodyText, QuickLogThrowSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { event, implementWeight, distance, feeling, notes } = parsed;

    const distanceNum = distance ?? null;
    const feelingVal: Feeling | null = feeling ?? null;
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
    let previousBest: number | null = null;
    let previousBestDate: string | null = null;
    if (distanceNum != null && distanceNum > 0) {
      const prResult = await recordThrow({
        athleteId: athlete.id,
        event,
        implementWeightKg: implementWeight,
        distance: distanceNum,
      });
      isPersonalBest = prResult.isPersonalBest;
      previousBest = prResult.previousDistance;
      previousBestDate = prResult.previousAchievedAt;

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
          previousDistance: prResult.previousDistance,
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
        previousBest,
        previousBestDate,
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

    const parsed = await parseBody(req, QuickLogEditSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { id, distance, feeling, notes } = parsed;

    // Find and verify ownership
    const existing = await prisma.throwLog.findUnique({
      where: { id },
      select: {
        id: true,
        athleteId: true,
        event: true,
        implementWeight: true,
        distance: true,
        notes: true,
        isPersonalBest: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }
    if (existing.athleteId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const newDistance = distance === undefined ? existing.distance : distance;
    const newFeeling: Feeling | null = feeling === undefined || feeling === null ? null : feeling;
    const newNotesText = notes === undefined || notes === null ? null : notes.trim() || null;

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
      const prResult = await recordThrow({
        athleteId: athlete.id,
        event: existing.event as string,
        implementWeightKg: existing.implementWeight,
        distance: newDistance,
      });
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
    return NextResponse.json({ success: false, error: "Couldn’t update throw." }, { status: 500 });
  }
}
