/**
 * Data layer for practice scheduling and attendance.
 * Implements conflict detection via AthleteAvailability + AvailabilityOverride.
 */

import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED" | "LATE";

export type PracticeListItem = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  status: string;
  groupId: string | null;
  groupName: string | null;
  recurringId: string | null;
  attendingCount: number;       // present + late
  conflictCount: number;        // athletes with conflict at this time
  totalEligibleAthletes: number;
  attendance: Array<{
    athleteId: string;
    athleteName: string;
    status: AttendanceStatus;
    notes: string | null;
  }>;
};

export type ConflictAthlete = {
  athleteId: string;
  athleteName: string;
  reason: string; // e.g. "Class 3-4pm"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the day-of-week (0=Sunday…6=Saturday) from a YYYY-MM-DD string,
 *  anchored to noon UTC to sidestep timezone boundary issues. */
function dayOfWeekFromDate(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

/** Returns true when [aStart, aEnd) and [bStart, bEnd) overlap (string "HH:MM" comparison works because zero-padded). */
function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

/**
 * For a given set of athletes, returns those who have an availability conflict
 * at the practice's date + time window.
 *
 * Conflict = UNAVAILABLE or CONDITIONAL recurring block on that day-of-week
 *            that overlaps the practice time, OR an UNAVAILABLE override for
 *            that exact date that overlaps (or covers the whole day).
 */
async function detectConflicts(
  athleteIds: string[],
  date: string,
  startTime: string,
  endTime: string,
  athleteNames: Map<string, string>
): Promise<ConflictAthlete[]> {
  if (athleteIds.length === 0) return [];

  const dow = dayOfWeekFromDate(date);

  const [blocks, overrides] = await Promise.all([
    prisma.athleteAvailability.findMany({
      where: {
        athleteId: { in: athleteIds },
        dayOfWeek: dow,
        type: { in: ["UNAVAILABLE", "CONDITIONAL"] },
      },
    }),
    prisma.availabilityOverride.findMany({
      where: {
        athleteId: { in: athleteIds },
        date,
        type: "UNAVAILABLE",
      },
    }),
  ]);

  const conflictMap = new Map<string, string>(); // athleteId → reason

  for (const block of blocks) {
    if (timesOverlap(startTime, endTime, block.startTime, block.endTime)) {
      if (!conflictMap.has(block.athleteId)) {
        const label = block.label ?? block.type;
        conflictMap.set(
          block.athleteId,
          `${label} ${block.startTime}–${block.endTime}`
        );
      }
    }
  }

  for (const override of overrides) {
    // Whole-day override has null start/end — always conflicts
    const overlapOrWholeDay =
      override.startTime == null ||
      timesOverlap(
        startTime,
        endTime,
        override.startTime,
        override.endTime ?? "23:59"
      );

    if (overlapOrWholeDay) {
      const reason = override.reason ?? "Unavailable";
      conflictMap.set(override.athleteId, reason);
    }
  }

  const conflicts: ConflictAthlete[] = [];
  for (const [athleteId, reason] of conflictMap) {
    conflicts.push({
      athleteId,
      athleteName: athleteNames.get(athleteId) ?? athleteId,
      reason,
    });
  }
  return conflicts;
}

// ─── Eligible Athlete Helpers ─────────────────────────────────────────────────

async function getEligibleAthletes(coachId: string, groupId: string | null) {
  if (groupId) {
    const members = await prisma.eventGroupMember.findMany({
      where: { groupId },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            events: true,
            coachId: true,
          },
        },
      },
    });
    // Only athletes who actually belong to this coach
    return members
      .map((m) => m.athlete)
      .filter((a) => a.coachId === coachId);
  }

  return prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      events: true,
      coachId: true,
    },
  });
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Fetch all practices for a coach in a date range. Computes conflict counts
 * by intersecting practice time with athlete availability.
 */
export async function getCoachPractices(
  coachId: string,
  startDate: string,
  endDate: string
): Promise<PracticeListItem[]> {
  const practices = await prisma.scheduledPractice.findMany({
    where: {
      coachId,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      group: { select: { id: true, name: true } },
      attendance: {
        include: {
          athlete: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // For conflict computation we need eligible athlete lists per practice
  // Group practices by groupId to batch athlete lookups
  const groupIds = [...new Set(practices.map((p) => p.groupId))];

  // Build a map: groupId (or "ALL") → athlete IDs
  const eligibleMap = new Map<string | null, { id: string; firstName: string; lastName: string }[]>();

  // Fetch all-roster athletes once
  const allAthletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true },
  });
  eligibleMap.set(null, allAthletes);

  for (const gid of groupIds) {
    if (gid == null) continue;
    const members = await prisma.eventGroupMember.findMany({
      where: { groupId: gid },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, coachId: true } },
      },
    });
    eligibleMap.set(
      gid,
      members
        .filter((m) => m.athlete.coachId === coachId)
        .map((m) => ({
          id: m.athlete.id,
          firstName: m.athlete.firstName,
          lastName: m.athlete.lastName,
        }))
    );
  }

  const result: PracticeListItem[] = [];

  for (const p of practices) {
    const eligible = eligibleMap.get(p.groupId) ?? allAthletes;
    const athleteIds = eligible.map((a) => a.id);
    const nameMap = new Map<string, string>(
      eligible.map((a) => [a.id, `${a.firstName} ${a.lastName}`])
    );

    const conflicts = await detectConflicts(
      athleteIds,
      p.date,
      p.startTime,
      p.endTime,
      nameMap
    );

    const attendingCount = p.attendance.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;

    result.push({
      id: p.id,
      title: p.title,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      location: p.location,
      notes: p.notes,
      status: p.status,
      groupId: p.groupId,
      groupName: p.group?.name ?? null,
      recurringId: p.recurringId,
      attendingCount,
      conflictCount: conflicts.length,
      totalEligibleAthletes: eligible.length,
      attendance: p.attendance.map((a) => ({
        athleteId: a.athleteId,
        athleteName: `${a.athlete.firstName} ${a.athlete.lastName}`,
        status: a.status as AttendanceStatus,
        notes: a.notes,
      })),
    });
  }

  return result;
}

/**
 * Fetch a single practice with full attendance + conflict details.
 */
export async function getPracticeDetail(
  practiceId: string,
  coachId: string
): Promise<{
  practice: PracticeListItem;
  conflicts: ConflictAthlete[];
  eligibleAthletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    events: string[];
    conflict: ConflictAthlete | null;
  }>;
} | null> {
  const p = await prisma.scheduledPractice.findFirst({
    where: { id: practiceId, coachId },
    include: {
      group: { select: { id: true, name: true } },
      attendance: {
        include: {
          athlete: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!p) return null;

  const eligible = await getEligibleAthletes(coachId, p.groupId);
  const athleteIds = eligible.map((a) => a.id);
  const nameMap = new Map<string, string>(
    eligible.map((a) => [a.id, `${a.firstName} ${a.lastName}`])
  );

  const conflicts = await detectConflicts(
    athleteIds,
    p.date,
    p.startTime,
    p.endTime,
    nameMap
  );

  const conflictByAthleteId = new Map<string, ConflictAthlete>(
    conflicts.map((c) => [c.athleteId, c])
  );

  const attendingCount = p.attendance.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;

  const practice: PracticeListItem = {
    id: p.id,
    title: p.title,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location,
    notes: p.notes,
    status: p.status,
    groupId: p.groupId,
    groupName: p.group?.name ?? null,
    recurringId: p.recurringId,
    attendingCount,
    conflictCount: conflicts.length,
    totalEligibleAthletes: eligible.length,
    attendance: p.attendance.map((a) => ({
      athleteId: a.athleteId,
      athleteName: `${a.athlete.firstName} ${a.athlete.lastName}`,
      status: a.status as AttendanceStatus,
      notes: a.notes,
    })),
  };

  return {
    practice,
    conflicts,
    eligibleAthletes: eligible.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avatarUrl: a.avatarUrl,
      events: a.events as string[],
      conflict: conflictByAthleteId.get(a.id) ?? null,
    })),
  };
}

/**
 * Create a single practice. Returns the created practice id.
 */
export async function createPractice(
  coachId: string,
  data: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    notes?: string;
    groupId?: string;
  }
): Promise<{ id: string }> {
  const practice = await prisma.scheduledPractice.create({
    data: {
      coachId,
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location ?? null,
      notes: data.notes ?? null,
      groupId: data.groupId ?? null,
    },
  });
  return { id: practice.id };
}

/**
 * Create a recurring practice series. Generates one ScheduledPractice per
 * week from startDate to untilDate. All instances share a recurringId.
 */
export async function createRecurringPractices(
  coachId: string,
  data: {
    title: string;
    startDate: string;
    untilDate: string;
    startTime: string;
    endTime: string;
    location?: string;
    notes?: string;
    groupId?: string;
  }
): Promise<{ recurringId: string; instanceCount: number }> {
  const recurringId = generateCuid();

  // Build all dates — weekly increments from startDate to untilDate
  const instances: Array<{
    coachId: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string | null;
    notes: string | null;
    groupId: string | null;
    recurringId: string;
  }> = [];

  let current = new Date(data.startDate + "T12:00:00Z");
  const until = new Date(data.untilDate + "T12:00:00Z");

  while (current <= until) {
    const dateStr = current.toISOString().slice(0, 10);
    instances.push({
      coachId,
      title: data.title,
      date: dateStr,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location ?? null,
      notes: data.notes ?? null,
      groupId: data.groupId ?? null,
      recurringId,
    });
    // Advance by exactly 7 days
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  if (instances.length === 0) {
    throw new Error("startDate must be on or before untilDate");
  }

  await prisma.$transaction(
    instances.map((inst) => prisma.scheduledPractice.create({ data: inst }))
  );

  return { recurringId, instanceCount: instances.length };
}

/**
 * Update a single practice, optionally cascading to all future instances in the
 * series (applyToSeries = true).
 */
export async function updatePractice(
  practiceId: string,
  coachId: string,
  data: Partial<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string | null;
    notes: string | null;
    status: string;
    groupId: string | null;
  }>,
  applyToSeries?: boolean
): Promise<{ id: string; updatedCount: number }> {
  const existing = await prisma.scheduledPractice.findFirst({
    where: { id: practiceId, coachId },
  });
  if (!existing) throw new Error("Practice not found or access denied");

  // Build update payload — only include defined keys
  const updatePayload: Record<string, unknown> = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.date !== undefined) updatePayload.date = data.date;
  if (data.startTime !== undefined) updatePayload.startTime = data.startTime;
  if (data.endTime !== undefined) updatePayload.endTime = data.endTime;
  if ("location" in data) updatePayload.location = data.location;
  if ("notes" in data) updatePayload.notes = data.notes;
  if (data.status !== undefined) updatePayload.status = data.status;
  if ("groupId" in data) updatePayload.groupId = data.groupId;

  if (applyToSeries && existing.recurringId) {
    // Apply to all future instances (date >= this practice's date) in the series
    const result = await prisma.scheduledPractice.updateMany({
      where: {
        recurringId: existing.recurringId,
        coachId,
        date: { gte: existing.date },
        status: { not: "CANCELLED" },
      },
      data: updatePayload,
    });
    return { id: practiceId, updatedCount: result.count };
  }

  await prisma.scheduledPractice.update({
    where: { id: practiceId },
    data: updatePayload,
  });
  return { id: practiceId, updatedCount: 1 };
}

/**
 * Delete (or cancel) a practice. If applyToSeries, cancel all future instances
 * sharing the recurringId.
 */
export async function deletePractice(
  practiceId: string,
  coachId: string,
  applyToSeries?: boolean
): Promise<{ deletedCount: number }> {
  const existing = await prisma.scheduledPractice.findFirst({
    where: { id: practiceId, coachId },
  });
  if (!existing) throw new Error("Practice not found or access denied");

  if (applyToSeries && existing.recurringId) {
    // Cancel all future instances (SCHEDULED → CANCELLED)
    const result = await prisma.scheduledPractice.updateMany({
      where: {
        recurringId: existing.recurringId,
        coachId,
        date: { gte: existing.date },
        status: "SCHEDULED",
      },
      data: { status: "CANCELLED" },
    });
    return { deletedCount: result.count };
  }

  await prisma.scheduledPractice.delete({ where: { id: practiceId } });
  return { deletedCount: 1 };
}

/**
 * Batch update attendance statuses for a practice.
 * Pass status: null to remove (unmark) the record.
 */
export async function batchUpdateAttendance(
  practiceId: string,
  coachId: string,
  updates: Array<{
    athleteId: string;
    status: AttendanceStatus | null;
    notes?: string;
  }>
): Promise<{ updated: number }> {
  // Verify practice belongs to coach
  const practice = await prisma.scheduledPractice.findFirst({
    where: { id: practiceId, coachId },
  });
  if (!practice) throw new Error("Practice not found or access denied");

  let updated = 0;

  await prisma.$transaction(
    updates.map((u) => {
      if (u.status === null) {
        // Delete the attendance record (back to unmarked)
        updated++;
        return prisma.scheduledPracticeAttendance.deleteMany({
          where: { practiceId, athleteId: u.athleteId },
        });
      }
      updated++;
      return prisma.scheduledPracticeAttendance.upsert({
        where: {
          practiceId_athleteId: { practiceId, athleteId: u.athleteId },
        },
        create: {
          practiceId,
          athleteId: u.athleteId,
          status: u.status,
          markedBy: coachId,
          notes: u.notes ?? null,
        },
        update: {
          status: u.status,
          markedBy: coachId,
          markedAt: new Date(),
          notes: u.notes !== undefined ? u.notes : undefined,
        },
      });
    })
  );

  return { updated };
}

/**
 * Mark all currently unmarked eligible athletes as PRESENT for a practice.
 */
export async function markAllPresent(
  practiceId: string,
  coachId: string
): Promise<{ marked: number }> {
  const practice = await prisma.scheduledPractice.findFirst({
    where: { id: practiceId, coachId },
    include: {
      attendance: { select: { athleteId: true } },
    },
  });
  if (!practice) throw new Error("Practice not found or access denied");

  const eligible = await getEligibleAthletes(coachId, practice.groupId);
  const alreadyMarked = new Set(practice.attendance.map((a) => a.athleteId));

  const unmarked = eligible.filter((a) => !alreadyMarked.has(a.id));
  if (unmarked.length === 0) return { marked: 0 };

  await prisma.$transaction(
    unmarked.map((a) =>
      prisma.scheduledPracticeAttendance.create({
        data: {
          practiceId,
          athleteId: a.id,
          status: "PRESENT",
          markedBy: coachId,
        },
      })
    )
  );

  return { marked: unmarked.length };
}

/**
 * Get attendance analytics for an athlete over a date range.
 */
export async function getAthleteAttendanceStats(
  athleteId: string,
  daysBack: number
): Promise<{
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
  currentStreak: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().slice(0, 10);

  const records = await prisma.scheduledPracticeAttendance.findMany({
    where: {
      athleteId,
      practice: { date: { gte: sinceStr }, status: { not: "CANCELLED" } },
    },
    include: {
      practice: { select: { date: true } },
    },
    orderBy: { practice: { date: "desc" } },
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const r of records) {
    if (r.status === "PRESENT") present++;
    else if (r.status === "LATE") late++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "EXCUSED") excused++;
  }

  const total = records.length;
  const rate = total === 0 ? 0 : Math.round(((present + late) / total) * 100);

  // Streak = consecutive PRESENT or LATE from most recent backwards
  let currentStreak = 0;
  for (const r of records) {
    if (r.status === "PRESENT" || r.status === "LATE") {
      currentStreak++;
    } else {
      break;
    }
  }

  return { total, present, late, absent, excused, rate, currentStreak };
}

/**
 * Get team-level attendance stats for the coach's roster.
 */
export async function getTeamAttendanceStats(
  coachId: string,
  daysBack: number
): Promise<{
  rate: number;
  totalPractices: number;
  flaggedAthletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    rate: number;
  }>;
}> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().slice(0, 10);

  // Count practices in range for this coach
  const totalPractices = await prisma.scheduledPractice.count({
    where: {
      coachId,
      date: { gte: sinceStr },
      status: { not: "CANCELLED" },
    },
  });

  if (totalPractices === 0) {
    return { rate: 0, totalPractices: 0, flaggedAthletes: [] };
  }

  // Get all attendance records for those practices
  const allAttendance = await prisma.scheduledPracticeAttendance.findMany({
    where: {
      practice: {
        coachId,
        date: { gte: sinceStr },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      athleteId: true,
      status: true,
    },
  });

  // Get roster
  const roster = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });

  // Build per-athlete rate
  const athleteRecords = new Map<string, { present: number; total: number }>();
  for (const r of allAttendance) {
    const cur = athleteRecords.get(r.athleteId) ?? { present: 0, total: 0 };
    cur.total++;
    if (r.status === "PRESENT" || r.status === "LATE") cur.present++;
    athleteRecords.set(r.athleteId, cur);
  }

  let teamPresent = 0;
  let teamTotal = 0;
  const flaggedAthletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    rate: number;
  }> = [];

  for (const athlete of roster) {
    const rec = athleteRecords.get(athlete.id);
    if (!rec || rec.total === 0) continue;
    teamPresent += rec.present;
    teamTotal += rec.total;
    const athleteRate = Math.round((rec.present / rec.total) * 100);
    if (athleteRate < 75) {
      flaggedAthletes.push({
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        avatarUrl: athlete.avatarUrl,
        rate: athleteRate,
      });
    }
  }

  const rate = teamTotal === 0 ? 0 : Math.round((teamPresent / teamTotal) * 100);

  return {
    rate,
    totalPractices,
    flaggedAthletes: flaggedAthletes.sort((a, b) => a.rate - b.rate),
  };
}

// ─── Internal CUID fallback ───────────────────────────────────────────────────

/** Simple CUID-like ID generator used for recurringId. */
function generateCuid(): string {
  // Use crypto.randomUUID and strip dashes to produce a compact unique ID
  return "c" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}
