/**
 * Server-side data-fetching and mutation functions for Programmed Sessions.
 * Implements the trickle-down resolution algorithm:
 *   TEAM → GROUP override → INDIVIDUAL override
 *
 * Read functions use React cache() for per-request deduplication.
 */

import { cache } from "react";
import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type SessionTier = "TEAM" | "GROUP" | "INDIVIDUAL";

export interface ProgrammedSessionWithDetails {
  id: string;
  title: string;
  scheduledDate: string;
  notes: string | null;
  tier: SessionTier;
  status: string;
  publishedAt: string | null;
  throwsSession: {
    id: string;
    name: string;
    event: string;
    sessionType: string;
    blockCount: number;
  };
  group: { id: string; name: string; color: string | null } | null;
  athlete: { id: string; firstName: string; lastName: string } | null;
  parentId: string | null;
  overrideCount: number;
}

export interface ResolvedSession {
  throwsSessionId: string;
  tier: SessionTier;
  sourceId: string;
}

export interface PublishResult {
  created: number;
  updated: number;
}

/* ─── Reads ──────────────────────────────────────────────────────────────── */

/**
 * Returns all programmed sessions for a coach within a date range.
 * Wrapped in React cache() — deduplicated within one server render tree.
 */
export const getProgrammedSessions = cache(
  async (coachId: string, start: string, end: string): Promise<ProgrammedSessionWithDetails[]> => {
    const sessions = await prisma.programmedSession.findMany({
      where: {
        coachId,
        scheduledDate: { gte: start, lte: end },
      },
      include: {
        throwsSession: {
          select: {
            id: true,
            name: true,
            event: true,
            sessionType: true,
            blocks: { select: { id: true } },
          },
        },
        group: {
          select: { id: true, name: true, color: true },
        },
        athlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { overrides: true },
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      scheduledDate: s.scheduledDate,
      notes: s.notes,
      tier: s.tier as SessionTier,
      status: s.status,
      publishedAt: s.publishedAt?.toISOString() ?? null,
      throwsSession: {
        id: s.throwsSession.id,
        name: s.throwsSession.name,
        event: s.throwsSession.event,
        sessionType: s.throwsSession.sessionType,
        blockCount: s.throwsSession.blocks.length,
      },
      group: s.group ? { id: s.group.id, name: s.group.name, color: s.group.color } : null,
      athlete: s.athlete
        ? {
            id: s.athlete.id,
            firstName: s.athlete.firstName,
            lastName: s.athlete.lastName,
          }
        : null,
      parentId: s.parentId,
      overrideCount: s._count.overrides,
    }));
  }
);

/* ─── Mutations ──────────────────────────────────────────────────────────── */

/**
 * Creates a new programmed session.
 */
export async function createProgrammedSession(
  coachId: string,
  data: {
    title: string;
    scheduledDate: string;
    throwsSessionId: string;
    tier: SessionTier;
    groupId?: string;
    athleteId?: string;
    parentId?: string;
    notes?: string;
  }
) {
  return prisma.programmedSession.create({
    data: {
      coachId,
      title: data.title.trim(),
      scheduledDate: data.scheduledDate,
      throwsSessionId: data.throwsSessionId,
      tier: data.tier,
      groupId: data.groupId ?? null,
      athleteId: data.athleteId ?? null,
      parentId: data.parentId ?? null,
      notes: data.notes?.trim() ?? null,
    },
  });
}

/**
 * Updates an existing programmed session. Scoped to coachId for safety.
 */
export async function updateProgrammedSession(
  id: string,
  coachId: string,
  data: {
    title?: string;
    throwsSessionId?: string;
    notes?: string;
    scheduledDate?: string;
  }
) {
  return prisma.programmedSession.update({
    where: { id, coachId },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.throwsSessionId !== undefined ? { throwsSessionId: data.throwsSessionId } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() ?? null } : {}),
      ...(data.scheduledDate !== undefined ? { scheduledDate: data.scheduledDate } : {}),
    },
  });
}

/**
 * Deletes a programmed session and cascades to overrides (via parentId FK onDelete: Cascade).
 */
export async function deleteProgrammedSession(id: string, coachId: string): Promise<void> {
  await prisma.programmedSession.delete({ where: { id, coachId } });
}

/**
 * Creates a tier override for an existing parent session.
 * Inherits title and scheduledDate from the parent.
 */
export async function createOverride(
  parentId: string,
  coachId: string,
  data: {
    throwsSessionId: string;
    tier: "GROUP" | "INDIVIDUAL";
    groupId?: string;
    athleteId?: string;
  }
) {
  // Fetch the parent to inherit title + scheduledDate
  const parent = await prisma.programmedSession.findFirst({
    where: { id: parentId, coachId },
    select: { title: true, scheduledDate: true },
  });
  if (!parent) {
    throw new Error("Parent session not found or access denied");
  }

  return prisma.programmedSession.create({
    data: {
      coachId,
      title: parent.title,
      scheduledDate: parent.scheduledDate,
      throwsSessionId: data.throwsSessionId,
      tier: data.tier,
      groupId: data.groupId ?? null,
      athleteId: data.athleteId ?? null,
      parentId,
    },
  });
}

/* ─── Resolution Algorithm ───────────────────────────────────────────────── */

/**
 * Resolves the effective session template for a specific athlete on a specific date.
 *
 * Trickle-down resolution order:
 * 1. INDIVIDUAL override for this athlete → use it
 * 2. GROUP override whose group contains this athlete → use it (lowest group.order wins ties)
 * 3. Fall back to the TEAM-tier parent session
 *
 * Returns null if no PUBLISHED session exists for this date.
 */
export async function resolveEffectiveSession(
  coachId: string,
  athleteId: string,
  scheduledDate: string
): Promise<ResolvedSession | null> {
  // Fetch all published sessions for this coach/date
  const sessions = await prisma.programmedSession.findMany({
    where: {
      coachId,
      scheduledDate,
      status: "PUBLISHED",
    },
    include: {
      group: {
        select: {
          id: true,
          order: true,
          members: {
            where: { athleteId },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Find the TEAM-tier root sessions (no parent)
  const teamSessions = sessions.filter((s) => s.tier === "TEAM" && s.parentId === null);

  if (teamSessions.length === 0) {
    // Check if there's a direct INDIVIDUAL session for this athlete (standalone, no parent)
    const directIndividual = sessions.find(
      (s) => s.tier === "INDIVIDUAL" && s.athleteId === athleteId && s.parentId === null
    );
    if (directIndividual) {
      return {
        throwsSessionId: directIndividual.throwsSessionId,
        tier: "INDIVIDUAL",
        sourceId: directIndividual.id,
      };
    }

    // Check for standalone GROUP sessions that include this athlete
    const directGroup = sessions
      .filter(
        (s) =>
          s.tier === "GROUP" &&
          s.parentId === null &&
          s.group?.members?.length &&
          s.group.members.length > 0
      )
      .sort((a, b) => (a.group?.order ?? 0) - (b.group?.order ?? 0));

    if (directGroup.length > 0) {
      return {
        throwsSessionId: directGroup[0].throwsSessionId,
        tier: "GROUP",
        sourceId: directGroup[0].id,
      };
    }

    return null;
  }

  // For the first TEAM session, resolve through the override chain
  const teamSession = teamSessions[0];

  // Gather all overrides for this team session
  const overrides = sessions.filter((s) => s.parentId === teamSession.id);

  // 1. Check for INDIVIDUAL override targeting this specific athlete
  const individualOverride = overrides.find(
    (s) => s.tier === "INDIVIDUAL" && s.athleteId === athleteId
  );
  if (individualOverride) {
    return {
      throwsSessionId: individualOverride.throwsSessionId,
      tier: "INDIVIDUAL",
      sourceId: individualOverride.id,
    };
  }

  // 2. Check for GROUP overrides where the group contains this athlete
  const matchingGroupOverrides = overrides
    .filter((s) => s.tier === "GROUP" && s.group?.members?.length && s.group.members.length > 0)
    .sort((a, b) => (a.group?.order ?? 0) - (b.group?.order ?? 0));

  if (matchingGroupOverrides.length > 0) {
    return {
      throwsSessionId: matchingGroupOverrides[0].throwsSessionId,
      tier: "GROUP",
      sourceId: matchingGroupOverrides[0].id,
    };
  }

  // 3. Fall back to the TEAM session
  return {
    throwsSessionId: teamSession.throwsSessionId,
    tier: "TEAM",
    sourceId: teamSession.id,
  };
}

/* ─── Publish Flow ───────────────────────────────────────────────────────── */

/**
 * Publishes a programmed session and creates/updates ThrowsAssignments
 * for all affected athletes.
 *
 * Affected athletes depend on tier:
 * - TEAM: all athletes on the coach's roster
 * - GROUP: all members of the session's group
 * - INDIVIDUAL: the single targeted athlete
 *
 * For each affected athlete, resolveEffectiveSession determines which
 * template they actually get. Existing assignments linked to this
 * programmed session are updated (unless COMPLETED/IN_PROGRESS).
 */
export async function publishSession(id: string, coachId: string): Promise<PublishResult> {
  // 1. Fetch the session with group members if applicable
  const session = await prisma.programmedSession.findFirst({
    where: { id, coachId },
    include: {
      group: {
        include: {
          members: { select: { athleteId: true } },
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found or access denied");
  }

  // 2. Set status = PUBLISHED
  await prisma.programmedSession.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // 3. Determine affected athletes
  let affectedAthleteIds: string[];

  switch (session.tier) {
    case "TEAM": {
      const allAthletes = await prisma.athleteProfile.findMany({
        where: { coachId },
        select: { id: true },
      });
      affectedAthleteIds = allAthletes.map((a) => a.id);
      break;
    }
    case "GROUP": {
      if (!session.group) {
        throw new Error("GROUP-tier session has no group assigned");
      }
      affectedAthleteIds = session.group.members.map((m) => m.athleteId);
      break;
    }
    case "INDIVIDUAL": {
      if (!session.athleteId) {
        throw new Error("INDIVIDUAL-tier session has no athlete assigned");
      }
      affectedAthleteIds = [session.athleteId];
      break;
    }
    default:
      throw new Error(`Unknown tier: ${session.tier}`);
  }

  // 4. For each athlete, resolve effective session and upsert assignment
  let created = 0;
  let updated = 0;

  for (const athleteId of affectedAthleteIds) {
    const resolved = await resolveEffectiveSession(coachId, athleteId, session.scheduledDate);

    if (!resolved) continue;

    // Check for existing assignment linked to this programmed session chain
    // We look for assignments with programmedSessionId matching any session
    // in the override chain rooted at this session (or its parent)
    const rootId = session.parentId ?? session.id;

    // Find all session IDs in this chain (root + overrides)
    const chainSessions = await prisma.programmedSession.findMany({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      select: { id: true },
    });
    const chainIds = chainSessions.map((s) => s.id);

    const existing = await prisma.throwsAssignment.findFirst({
      where: {
        athleteId,
        assignedDate: session.scheduledDate,
        programmedSessionId: { in: chainIds },
      },
    });

    if (existing) {
      // Skip if already completed or in progress
      if (existing.status === "COMPLETED" || existing.status === "IN_PROGRESS") {
        continue;
      }

      // Update with new resolved template
      await prisma.throwsAssignment.update({
        where: { id: existing.id },
        data: {
          sessionId: resolved.throwsSessionId,
          programmedSessionId: resolved.sourceId,
        },
      });
      updated++;
    } else {
      // Create new assignment
      await prisma.throwsAssignment.create({
        data: {
          sessionId: resolved.throwsSessionId,
          athleteId,
          assignedDate: session.scheduledDate,
          programmedSessionId: resolved.sourceId,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
