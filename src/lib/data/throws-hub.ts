import prisma from "@/lib/prisma";
import type { UpcomingSessionItem } from "@/lib/data/dashboard";

/**
 * Fetches the next 3 upcoming throws assignments for an athlete.
 *
 * Queries `prisma.throwsAssignment` (the new throws scheduling model)
 * instead of the legacy `trainingSession` table. Returns data in the
 * `UpcomingSessionItem[]` shape so the existing `UpcomingSessionsWidget`
 * can consume it with no changes.
 *
 * Filters to ASSIGNED / NOTIFIED / IN_PROGRESS — excludes COMPLETED,
 * SKIPPED, and PARTIAL (those are history, not "upcoming").
 */
export async function fetchUpcomingThrowsAssignments(
  athleteId: string
): Promise<UpcomingSessionItem[]> {
  const assignments = await prisma.throwsAssignment.findMany({
    where: {
      athleteId,
      status: { in: ["ASSIGNED", "NOTIFIED", "IN_PROGRESS"] },
    },
    include: {
      session: { select: { event: true, name: true } },
    },
    orderBy: { assignedDate: "asc" },
    take: 3,
  });

  return assignments.map((a) => ({
    id: a.id,
    scheduledDate: a.assignedDate,
    status: a.status,
    planName: a.session.name,
    coachNotes: null,
  }));
}
