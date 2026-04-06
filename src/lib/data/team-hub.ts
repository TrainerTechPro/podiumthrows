/**
 * Team Hub data layer — announcements, quick links, and team files.
 * All functions return plain serializable objects (dates as ISO strings).
 */

import prisma from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TeamAnnouncementItem = {
  id: string;
  title: string;
  body: string;
  priority: string;
  pinned: boolean;
  targetType: string;
  targetId: string | null;
  expiresAt: string | null;
  createdAt: string;
  authorName: string;
};

export type TeamLinkItem = {
  id: string;
  title: string;
  url: string;
  category: string | null;
  icon: string | null;
  order: number;
};

export type TeamFileItem = {
  id: string;
  name: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  category: string | null;
  createdAt: string;
};

// ─── Announcements ────────────────────────────────────────────────────────────

/**
 * Get all non-expired announcements for a coach (coach hub view).
 * Sorted: pinned first, then newest first.
 */
export async function getCoachAnnouncements(
  coachId: string,
): Promise<TeamAnnouncementItem[]> {
  const now = new Date();
  const items = await prisma.teamAnnouncement.findMany({
    where: {
      coachId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      coach: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return items.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    priority: a.priority,
    pinned: a.pinned,
    targetType: a.targetType,
    targetId: a.targetId,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    authorName: `${a.coach.firstName} ${a.coach.lastName}`.trim() || "Coach",
  }));
}

/**
 * Get announcements visible to a specific athlete.
 * - ALL → visible to everyone on the coach's roster
 * - GROUP → visible if athlete is a member of that EventGroup
 * - INDIVIDUAL → visible only if targetId === athleteId
 * Expired announcements are filtered out.
 */
export async function getAthleteAnnouncements(
  athleteId: string,
): Promise<TeamAnnouncementItem[]> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: {
      coachId: true,
      eventGroupMemberships: { select: { groupId: true } },
    },
  });
  if (!athlete) return [];

  const groupIds = athlete.eventGroupMemberships.map((m) => m.groupId);
  const now = new Date();

  const items = await prisma.teamAnnouncement.findMany({
    where: {
      coachId: athlete.coachId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [
        {
          OR: [
            { targetType: "ALL" },
            ...(groupIds.length > 0
              ? [{ targetType: "GROUP", targetId: { in: groupIds } }]
              : []),
            { targetType: "INDIVIDUAL", targetId: athleteId },
          ],
        },
      ],
    },
    include: {
      coach: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return items.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    priority: a.priority,
    pinned: a.pinned,
    targetType: a.targetType,
    targetId: a.targetId,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    authorName: `${a.coach.firstName} ${a.coach.lastName}`.trim() || "Coach",
  }));
}

/** Create a new announcement. */
export async function createAnnouncement(
  coachId: string,
  data: {
    title: string;
    body: string;
    priority?: string;
    pinned?: boolean;
    targetType?: string;
    targetId?: string | null;
    expiresAt?: Date | null;
  },
): Promise<{ id: string }> {
  const a = await prisma.teamAnnouncement.create({
    data: {
      coachId,
      title: data.title,
      body: data.body,
      priority: data.priority ?? "NORMAL",
      pinned: data.pinned ?? false,
      targetType: data.targetType ?? "ALL",
      targetId: data.targetId ?? null,
      expiresAt: data.expiresAt ?? null,
    },
    select: { id: true },
  });
  return a;
}

/** Update an announcement — verifies coachId ownership first. */
export async function updateAnnouncement(
  id: string,
  coachId: string,
  data: Partial<{
    title: string;
    body: string;
    priority: string;
    pinned: boolean;
    targetType: string;
    targetId: string | null;
    expiresAt: Date | null;
  }>,
): Promise<void> {
  const existing = await prisma.teamAnnouncement.findUnique({
    where: { id },
    select: { coachId: true },
  });
  if (!existing || existing.coachId !== coachId) throw new Error("Not found");

  await prisma.teamAnnouncement.update({ where: { id }, data });
}

/** Delete an announcement — verifies coachId ownership first. */
export async function deleteAnnouncement(
  id: string,
  coachId: string,
): Promise<void> {
  const existing = await prisma.teamAnnouncement.findUnique({
    where: { id },
    select: { coachId: true },
  });
  if (!existing || existing.coachId !== coachId) throw new Error("Not found");
  await prisma.teamAnnouncement.delete({ where: { id } });
}

// ─── Quick Links ──────────────────────────────────────────────────────────────

/** List all team links for a coach, sorted by order then createdAt. */
export async function getTeamLinks(coachId: string): Promise<TeamLinkItem[]> {
  const links = await prisma.teamLink.findMany({
    where: { coachId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return links.map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    category: l.category,
    icon: l.icon,
    order: l.order,
  }));
}

/** Create a new team link, placed at the end of the current list. */
export async function createTeamLink(
  coachId: string,
  data: { title: string; url: string; category?: string; icon?: string },
): Promise<{ id: string }> {
  const max = await prisma.teamLink.aggregate({
    where: { coachId },
    _max: { order: true },
  });
  const nextOrder = (max._max.order ?? -1) + 1;

  const link = await prisma.teamLink.create({
    data: {
      coachId,
      title: data.title,
      url: data.url,
      category: data.category ?? null,
      icon: data.icon ?? null,
      order: nextOrder,
    },
    select: { id: true },
  });
  return link;
}

/** Update a team link — verifies coachId ownership first. */
export async function updateTeamLink(
  id: string,
  coachId: string,
  data: Partial<{
    title: string;
    url: string;
    category: string | null;
    icon: string | null;
  }>,
): Promise<void> {
  const existing = await prisma.teamLink.findUnique({
    where: { id },
    select: { coachId: true },
  });
  if (!existing || existing.coachId !== coachId) throw new Error("Not found");
  await prisma.teamLink.update({ where: { id }, data });
}

/** Delete a team link — verifies coachId ownership first. */
export async function deleteTeamLink(
  id: string,
  coachId: string,
): Promise<void> {
  const existing = await prisma.teamLink.findUnique({
    where: { id },
    select: { coachId: true },
  });
  if (!existing || existing.coachId !== coachId) throw new Error("Not found");
  await prisma.teamLink.delete({ where: { id } });
}

/**
 * Reorder links by providing the full sorted list of link IDs.
 * Verifies all IDs belong to the coach before updating.
 */
export async function reorderTeamLinks(
  coachId: string,
  orderedIds: string[],
): Promise<void> {
  const links = await prisma.teamLink.findMany({
    where: { id: { in: orderedIds }, coachId },
    select: { id: true },
  });
  if (links.length !== orderedIds.length) throw new Error("Invalid link IDs");

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.teamLink.update({
        where: { id },
        data: { order: idx },
      }),
    ),
  );
}

// ─── Team Files ───────────────────────────────────────────────────────────────

/** List all team files for a coach, newest first. */
export async function getTeamFiles(coachId: string): Promise<TeamFileItem[]> {
  const files = await prisma.teamFile.findMany({
    where: { coachId },
    orderBy: { createdAt: "desc" },
  });
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    fileUrl: f.fileUrl,
    fileKey: f.fileKey,
    fileSize: f.fileSize,
    mimeType: f.mimeType,
    category: f.category,
    createdAt: f.createdAt.toISOString(),
  }));
}

/** Create a team file record. */
export async function createTeamFile(
  coachId: string,
  data: {
    name: string;
    fileUrl: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
    category?: string | null;
  },
): Promise<{ id: string }> {
  const file = await prisma.teamFile.create({
    data: {
      coachId,
      name: data.name,
      fileUrl: data.fileUrl,
      fileKey: data.fileKey,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      category: data.category ?? null,
    },
    select: { id: true },
  });
  return file;
}

/** Delete a team file record — returns fileKey for R2 cleanup. */
export async function deleteTeamFile(
  id: string,
  coachId: string,
): Promise<{ fileKey: string }> {
  const existing = await prisma.teamFile.findUnique({
    where: { id },
    select: { coachId: true, fileKey: true },
  });
  if (!existing || existing.coachId !== coachId) throw new Error("Not found");
  await prisma.teamFile.delete({ where: { id } });
  return { fileKey: existing.fileKey };
}
