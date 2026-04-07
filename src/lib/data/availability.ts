/**
 * Data layer for athlete availability — CRUD operations and Best Windows computation.
 * Used by both athlete-facing and coach-facing API routes.
 */

import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvailabilityBlock = {
  id: string;
  athleteId: string;
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  startTime: string; // "HH:MM" 24h
  endTime: string;   // "HH:MM" 24h
  type: "AVAILABLE" | "UNAVAILABLE" | "CONDITIONAL";
  label: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityOverrideItem = {
  id: string;
  athleteId: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string | null;
  endTime: string | null;
  type: "AVAILABLE" | "UNAVAILABLE";
  reason: string | null;
  createdAt: string;
};

export type BestWindow = {
  dayOfWeek: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  availableCount: number;
  totalAthletes: number;
  percentAvailable: number;
  conflictAthletes: { id: string; name: string }[];
};

export type AthleteAvailabilitySummary = {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  blocks: AvailabilityBlock[];
  overrides: AvailabilityOverrideItem[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const VALID_TYPES = ["AVAILABLE", "UNAVAILABLE", "CONDITIONAL"] as const;
export const VALID_OVERRIDE_TYPES = ["AVAILABLE", "UNAVAILABLE"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "HH:MM" to total minutes since midnight. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes since midnight to "HH:MM". */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Expand an AVAILABLE block into a Set of 30-minute slot start-minutes.
 * Slots are generated from 06:00 (360) to 22:00 (1320), stepping by 30.
 */
function expandBlockToSlots(
  startTime: string,
  endTime: string
): Set<number> {
  const slots = new Set<number>();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const SLOT_START = 360;  // 06:00
  const SLOT_END = 1320;   // 22:00
  const STEP = 30;

  for (let t = SLOT_START; t < SLOT_END; t += STEP) {
    // A slot [t, t+30) overlaps the block if t >= blockStart and t+STEP <= blockEnd
    if (t >= start && t + STEP <= end) {
      slots.add(t);
    }
  }
  return slots;
}

// ─── Athlete CRUD: Recurring Blocks ──────────────────────────────────────────

export async function getAthleteAvailability(athleteId: string): Promise<{
  blocks: AvailabilityBlock[];
  overrides: AvailabilityOverrideItem[];
}> {
  const today = new Date().toISOString().slice(0, 10);

  const [blocks, overrides] = await Promise.all([
    prisma.athleteAvailability.findMany({
      where: { athleteId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.availabilityOverride.findMany({
      where: { athleteId, date: { gte: today } },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    blocks: blocks.map((b) => ({
      id: b.id,
      athleteId: b.athleteId,
      dayOfWeek: b.dayOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
      type: b.type as AvailabilityBlock["type"],
      label: b.label,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
    overrides: overrides.map((o) => ({
      id: o.id,
      athleteId: o.athleteId,
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      type: o.type as AvailabilityOverrideItem["type"],
      reason: o.reason,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export async function createAvailabilityBlock(
  athleteId: string,
  data: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type: string;
    label?: string | null;
    notes?: string | null;
  }
): Promise<AvailabilityBlock> {
  if (!VALID_TYPES.includes(data.type as (typeof VALID_TYPES)[number])) {
    throw new Error(`Invalid type: ${data.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (data.dayOfWeek < 0 || data.dayOfWeek > 6 || !Number.isInteger(data.dayOfWeek)) {
    throw new Error("dayOfWeek must be an integer 0–6");
  }
  if (timeToMinutes(data.startTime) >= timeToMinutes(data.endTime)) {
    throw new Error("startTime must be before endTime");
  }

  const block = await prisma.athleteAvailability.create({
    data: {
      athleteId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      label: data.label ?? null,
      notes: data.notes ?? null,
    },
  });

  return {
    id: block.id,
    athleteId: block.athleteId,
    dayOfWeek: block.dayOfWeek,
    startTime: block.startTime,
    endTime: block.endTime,
    type: block.type as AvailabilityBlock["type"],
    label: block.label,
    notes: block.notes,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };
}

export async function updateAvailabilityBlock(
  id: string,
  athleteId: string,
  data: Partial<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type: string;
    label: string | null;
    notes: string | null;
  }>
): Promise<AvailabilityBlock> {
  // Ownership check
  const existing = await prisma.athleteAvailability.findFirst({
    where: { id, athleteId },
  });
  if (!existing) {
    throw new Error("Availability block not found or access denied");
  }

  if (data.type !== undefined && !VALID_TYPES.includes(data.type as (typeof VALID_TYPES)[number])) {
    throw new Error(`Invalid type: ${data.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (
    data.dayOfWeek !== undefined &&
    (data.dayOfWeek < 0 || data.dayOfWeek > 6 || !Number.isInteger(data.dayOfWeek))
  ) {
    throw new Error("dayOfWeek must be an integer 0–6");
  }

  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw new Error("startTime must be before endTime");
  }

  const updated = await prisma.athleteAvailability.update({
    where: { id },
    data: {
      ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return {
    id: updated.id,
    athleteId: updated.athleteId,
    dayOfWeek: updated.dayOfWeek,
    startTime: updated.startTime,
    endTime: updated.endTime,
    type: updated.type as AvailabilityBlock["type"],
    label: updated.label,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteAvailabilityBlock(
  id: string,
  athleteId: string
): Promise<void> {
  const existing = await prisma.athleteAvailability.findFirst({
    where: { id, athleteId },
  });
  if (!existing) {
    throw new Error("Availability block not found or access denied");
  }
  await prisma.athleteAvailability.delete({ where: { id } });
}

// ─── Athlete CRUD: One-off Overrides ─────────────────────────────────────────

export async function createAvailabilityOverride(
  athleteId: string,
  data: {
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    type: string;
    reason?: string | null;
  }
): Promise<AvailabilityOverrideItem> {
  if (
    !VALID_OVERRIDE_TYPES.includes(
      data.type as (typeof VALID_OVERRIDE_TYPES)[number]
    )
  ) {
    throw new Error(
      `Invalid override type: ${data.type}. Must be one of: ${VALID_OVERRIDE_TYPES.join(", ")}`
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error("date must be in YYYY-MM-DD format");
  }

  const override = await prisma.availabilityOverride.create({
    data: {
      athleteId,
      date: data.date,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      type: data.type,
      reason: data.reason ?? null,
    },
  });

  return {
    id: override.id,
    athleteId: override.athleteId,
    date: override.date,
    startTime: override.startTime,
    endTime: override.endTime,
    type: override.type as AvailabilityOverrideItem["type"],
    reason: override.reason,
    createdAt: override.createdAt.toISOString(),
  };
}

export async function deleteAvailabilityOverride(
  id: string,
  athleteId: string
): Promise<void> {
  const existing = await prisma.availabilityOverride.findFirst({
    where: { id, athleteId },
  });
  if (!existing) {
    throw new Error("Availability override not found or access denied");
  }
  await prisma.availabilityOverride.delete({ where: { id } });
}

// ─── Coach Team View ──────────────────────────────────────────────────────────

export async function getTeamAvailability(
  coachId: string,
  groupId?: string,
  excludeInjured?: boolean
): Promise<{
  athletes: AthleteAvailabilitySummary[];
  bestWindows: BestWindow[];
  totalAthletes: number;
}> {
  const today = new Date().toISOString().slice(0, 10);

  const athletes = await prisma.athleteProfile.findMany({
    where: {
      coachId,
      ...(groupId
        ? { eventGroupMemberships: { some: { groupId } } }
        : {}),
      // When excludeInjured is true, filter out athletes with an active Injury
      // record (no recoveryDate / recovered=false) OR an active ThrowsInjury
      // (no returnToThrowDate set). We rely on the Injury model since it's the
      // general-purpose tracker. Athletes who have ANY unresolved injury are
      // excluded. The readinessCheckIn injuryStatus field is session-scoped and
      // not used here.
      ...(excludeInjured
        ? {
            injuries: {
              none: {
                recovered: false,
                recoveryDate: null,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      availabilityOverrides: {
        where: { date: { gte: today } },
        orderBy: { date: "asc" },
      },
    },
  });

  const summaries: AthleteAvailabilitySummary[] = athletes.map((a) => ({
    athleteId: a.id,
    athleteName: `${a.firstName} ${a.lastName}`,
    avatarUrl: a.avatarUrl,
    blocks: a.availability.map((b) => ({
      id: b.id,
      athleteId: b.athleteId,
      dayOfWeek: b.dayOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
      type: b.type as AvailabilityBlock["type"],
      label: b.label,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
    overrides: a.availabilityOverrides.map((o) => ({
      id: o.id,
      athleteId: o.athleteId,
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      type: o.type as AvailabilityOverrideItem["type"],
      reason: o.reason,
      createdAt: o.createdAt.toISOString(),
    })),
  }));

  const bestWindows = computeBestWindows(summaries);

  return {
    athletes: summaries,
    bestWindows,
    totalAthletes: summaries.length,
  };
}

// ─── Best Windows Algorithm ───────────────────────────────────────────────────

/**
 * Given a list of athlete availability summaries, compute the top 10 practice
 * windows where the highest percentage of athletes are simultaneously available.
 *
 * Algorithm:
 * 1. Generate 30-min slots from 06:00–22:00 for each day (0–6)
 * 2. For each athlete, expand AVAILABLE blocks → slots, then subtract
 *    UNAVAILABLE/CONDITIONAL blocks
 * 3. Count available athletes per (day, slot)
 * 4. Group consecutive slots on the same day where count ≥ 50% of total
 * 5. Sort by percentage desc, then duration desc → return top 10
 */
export function computeBestWindows(
  athletes: AthleteAvailabilitySummary[]
): BestWindow[] {
  const SLOT_START = 360;  // 06:00
  const SLOT_END = 1320;   // 22:00
  const STEP = 30;
  const total = athletes.length;

  if (total === 0) return [];

  // slotCounts[day][slotMinute] = Set of athlete IDs who are available
  const slotAthletes: Map<number, Map<number, Set<string>>> = new Map();
  for (let day = 0; day <= 6; day++) {
    const dayMap = new Map<number, Set<string>>();
    for (let t = SLOT_START; t < SLOT_END; t += STEP) {
      dayMap.set(t, new Set());
    }
    slotAthletes.set(day, dayMap);
  }

  for (const athlete of athletes) {
    // Build per-day available slots for this athlete
    const availableByDay = new Map<number, Set<number>>();
    const blockedByDay = new Map<number, Set<number>>();

    for (let day = 0; day <= 6; day++) {
      availableByDay.set(day, new Set());
      blockedByDay.set(day, new Set());
    }

    for (const block of athlete.blocks) {
      const slots = expandBlockToSlots(block.startTime, block.endTime);
      if (block.type === "AVAILABLE") {
        const existing = availableByDay.get(block.dayOfWeek)!;
        for (const s of slots) existing.add(s);
      } else {
        // UNAVAILABLE or CONDITIONAL both block availability
        const existing = blockedByDay.get(block.dayOfWeek)!;
        for (const s of slots) existing.add(s);
      }
    }

    // Subtract blocked slots from available slots
    for (let day = 0; day <= 6; day++) {
      const available = availableByDay.get(day)!;
      const blocked = blockedByDay.get(day)!;
      for (const s of blocked) available.delete(s);

      // Register this athlete in the team slot map
      const dayMap = slotAthletes.get(day)!;
      for (const s of available) {
        dayMap.get(s)?.add(athlete.athleteId);
      }
    }
  }

  // Group consecutive slots where count ≥ 50% into windows
  const windows: BestWindow[] = [];

  for (let day = 0; day <= 6; day++) {
    const dayMap = slotAthletes.get(day)!;
    const slots = Array.from(dayMap.keys()).sort((a, b) => a - b);

    let windowStart: number | null = null;
    let windowAthleteIds: Set<string> = new Set();
    let prevSlot: number | null = null;
    let windowCount = 0;

    const flushWindow = (endSlot: number) => {
      if (windowStart === null || windowCount === 0) return;
      const durationMinutes = endSlot - windowStart;
      const count = windowAthleteIds.size;
      const pct = Math.round((count / total) * 100);
      const conflictAthletes = athletes
        .filter((a) => !windowAthleteIds.has(a.athleteId))
        .map((a) => ({ id: a.athleteId, name: a.athleteName }));

      windows.push({
        dayOfWeek: day,
        dayLabel: DAY_LABELS[day],
        startTime: minutesToTime(windowStart),
        endTime: minutesToTime(endSlot),
        durationMinutes,
        availableCount: count,
        totalAthletes: total,
        percentAvailable: pct,
        conflictAthletes,
      });
    };

    for (const slot of slots) {
      const athleteSet = dayMap.get(slot)!;
      const count = athleteSet.size;
      const pct = count / total;

      if (pct >= 0.5) {
        const isConsecutive = prevSlot !== null && slot === prevSlot + STEP;

        if (windowStart !== null && isConsecutive) {
          // Extend current window — keep only athletes present in ALL slots
          for (const id of Array.from(windowAthleteIds)) {
            if (!athleteSet.has(id)) windowAthleteIds.delete(id);
          }
          windowCount++;
        } else {
          // Flush previous window if any, then start new one
          if (windowStart !== null) {
            flushWindow(prevSlot! + STEP);
          }
          windowStart = slot;
          windowAthleteIds = new Set(athleteSet);
          windowCount = 1;
        }
      } else {
        // Below threshold — flush any open window
        if (windowStart !== null) {
          flushWindow(prevSlot! + STEP);
          windowStart = null;
          windowAthleteIds = new Set();
          windowCount = 0;
        }
      }
      prevSlot = slot;
    }

    // Flush trailing window
    if (windowStart !== null && prevSlot !== null) {
      flushWindow(prevSlot + STEP);
    }
  }

  // Sort by percentage desc, then by duration desc, return top 10
  return windows
    .sort((a, b) =>
      b.percentAvailable !== a.percentAvailable
        ? b.percentAvailable - a.percentAvailable
        : b.durationMinutes - a.durationMinutes
    )
    .slice(0, 10);
}
