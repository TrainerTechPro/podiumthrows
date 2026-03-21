/**
 * Server-side data-fetching and mutation functions for Event Groups.
 * Read functions use React cache() for per-request deduplication.
 */

import { cache } from "react";
import prisma from "@/lib/prisma";
import type { EventType } from "@prisma/client";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type EventGroupMemberItem = {
  id: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: EventType[];
};

export type EventGroupItem = {
  id: string;
  coachId: string;
  name: string;
  description: string | null;
  events: EventType[];
  color: string | null;
  order: number;
  memberCount: number;
  members: EventGroupMemberItem[];
  createdAt: string;
  updatedAt: string;
};

/* ─── Reads ──────────────────────────────────────────────────────────────── */

/**
 * Returns all event groups for a coach with member counts and member details.
 * Wrapped in React cache() — deduplicated within one server render tree.
 */
export const getEventGroups = cache(async (coachId: string): Promise<EventGroupItem[]> => {
  const groups = await prisma.eventGroup.findMany({
    where: { coachId },
    include: {
      members: {
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              events: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  return groups.map((group) => ({
    id: group.id,
    coachId: group.coachId,
    name: group.name,
    description: group.description,
    events: group.events,
    color: group.color,
    order: group.order,
    memberCount: group.members.length,
    members: group.members.map((m) => ({
      id: m.id,
      athleteId: m.athleteId,
      firstName: m.athlete.firstName,
      lastName: m.athlete.lastName,
      avatarUrl: m.athlete.avatarUrl,
      events: m.athlete.events,
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  }));
});

/* ─── Mutations ──────────────────────────────────────────────────────────── */

export async function createEventGroup(
  coachId: string,
  data: {
    name: string;
    events: EventType[];
    color?: string;
    description?: string;
  }
): Promise<EventGroupItem> {
  const group = await prisma.eventGroup.create({
    data: {
      coachId,
      name: data.name.trim(),
      events: data.events,
      color: data.color ?? null,
      description: data.description?.trim() ?? null,
    },
    include: {
      members: {
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              events: true,
            },
          },
        },
      },
    },
  });

  return {
    id: group.id,
    coachId: group.coachId,
    name: group.name,
    description: group.description,
    events: group.events,
    color: group.color,
    order: group.order,
    memberCount: group.members.length,
    members: group.members.map((m) => ({
      id: m.id,
      athleteId: m.athleteId,
      firstName: m.athlete.firstName,
      lastName: m.athlete.lastName,
      avatarUrl: m.athlete.avatarUrl,
      events: m.athlete.events,
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function updateEventGroup(
  id: string,
  coachId: string,
  data: {
    name?: string;
    events?: EventType[];
    color?: string | null;
    description?: string | null;
    order?: number;
  }
): Promise<EventGroupItem> {
  const group = await prisma.eventGroup.update({
    where: { id, coachId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.events !== undefined ? { events: data.events } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() ?? null } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
    include: {
      members: {
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              events: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  return {
    id: group.id,
    coachId: group.coachId,
    name: group.name,
    description: group.description,
    events: group.events,
    color: group.color,
    order: group.order,
    memberCount: group.members.length,
    members: group.members.map((m) => ({
      id: m.id,
      athleteId: m.athleteId,
      firstName: m.athlete.firstName,
      lastName: m.athlete.lastName,
      avatarUrl: m.athlete.avatarUrl,
      events: m.athlete.events,
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function deleteEventGroup(id: string, coachId: string): Promise<void> {
  await prisma.eventGroup.delete({ where: { id, coachId } });
}

/**
 * Adds athletes to a group. Verifies the group belongs to the coach first.
 * Uses createMany with skipDuplicates — safe to call with already-present athletes.
 */
export async function addMembers(
  groupId: string,
  coachId: string,
  athleteIds: string[]
): Promise<void> {
  // Verify ownership
  const group = await prisma.eventGroup.findFirst({
    where: { id: groupId, coachId },
    select: { id: true },
  });
  if (!group) throw new Error("Event group not found or access denied");

  await prisma.eventGroupMember.createMany({
    data: athleteIds.map((athleteId) => ({ groupId, athleteId })),
    skipDuplicates: true,
  });
}

/**
 * Removes a single athlete from a group. Verifies group belongs to the coach first.
 */
export async function removeMember(
  groupId: string,
  coachId: string,
  athleteId: string
): Promise<void> {
  // Verify ownership
  const group = await prisma.eventGroup.findFirst({
    where: { id: groupId, coachId },
    select: { id: true },
  });
  if (!group) throw new Error("Event group not found or access denied");

  await prisma.eventGroupMember.deleteMany({
    where: { groupId, athleteId },
  });
}
