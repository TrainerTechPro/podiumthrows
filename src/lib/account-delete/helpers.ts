import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeletionEligibility {
  canDelete: boolean;
  reason?: string;
  athletesCount?: number;
}

/**
 * Coach deletion is blocked while the coach has any athletes — the
 * AthleteProfile.coachId FK is `onDelete: Cascade`, so a coach hard-delete
 * would obliterate athlete data. Until that schema rule changes (follow-up
 * to make coachId nullable + SetNull), the safe answer is to refuse the
 * delete and tell the coach to offboard their roster first.
 *
 * Athletes can always self-delete.
 */
export async function canDeleteAccount(userId: string): Promise<DeletionEligibility> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, coachProfile: { select: { id: true } } },
  });
  if (!user) return { canDelete: false, reason: "Account not found" };

  if (user.role === "COACH" && user.coachProfile) {
    const athletesCount = await prisma.athleteProfile.count({
      where: { coachId: user.coachProfile.id },
    });
    if (athletesCount > 0) {
      return {
        canDelete: false,
        reason:
          "You have athletes on your roster. Remove them or have them transfer to another coach before deleting your account.",
        athletesCount,
      };
    }
  }

  return { canDelete: true };
}

export interface SoftDeleteResult {
  deletedAt: Date;
  deleteScheduledFor: Date;
}

/**
 * Marks the user as soft-deleted. Both timestamps are written in the same
 * transaction so the grace window is always coherent. Caller is responsible
 * for clearing the auth cookie and writing the audit log.
 */
export async function softDeleteUser(userId: string): Promise<SoftDeleteResult> {
  const now = new Date();
  const deleteScheduledFor = new Date(now.getTime() + GRACE_PERIOD_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: now, deleteScheduledFor },
  });

  return { deletedAt: now, deleteScheduledFor };
}

/**
 * Clears the soft-delete markers iff the grace window hasn't lapsed.
 * Returns true on success, false if the user was never soft-deleted or
 * the grace window has expired (in which case the row is in line for
 * hard delete and shouldn't be revived).
 */
export async function restoreUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true, deleteScheduledFor: true },
  });
  if (!user || !user.deletedAt) return false;
  if (user.deleteScheduledFor && user.deleteScheduledFor < new Date()) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: null, deleteScheduledFor: null },
  });
  return true;
}

/**
 * Cron entry point. Returns the IDs of users hard-deleted so the caller
 * can write an audit row for each. Cascade does the heavy lifting per the
 * existing schema FK rules — the User row's children all use
 * `onDelete: Cascade` (CoachProfile, AthleteProfile, BetaFeedback,
 * PushSubscription, etc.), so deleting the User row removes the tree.
 */
export async function hardDeleteEligibleUsers(): Promise<{ deletedIds: string[] }> {
  const now = new Date();
  const eligible = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
      deleteScheduledFor: { lt: now },
    },
    select: { id: true },
  });

  const deletedIds: string[] = [];
  for (const { id } of eligible) {
    try {
      await prisma.user.delete({ where: { id } });
      deletedIds.push(id);
    } catch (err) {
      logger.error("hard-delete-user failed", {
        context: "account-delete/hard-delete",
        metadata: { userId: id },
        error: err,
      });
      // Continue — one bad row shouldn't block the rest of the batch.
    }
  }

  return { deletedIds };
}
