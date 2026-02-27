import prisma from "@/lib/prisma";

export type ActivityAction =
  | "SIGN_IN"
  | "CREATE_ATHLETE"
  | "DELETE_ATHLETE"
  | "PRESCRIBE_SESSION"
  | "IMPORT_EXERCISE"
  | "CREATE_EXERCISE"
  | "SEND_QUESTIONNAIRE"
  | "INVITE_ATHLETE"
  | "UPGRADE_PLAN"
  | "DOWNGRADE_PLAN"
  | "CANCEL_SUBSCRIPTION"
  | "ADD_VIDEO"
  | "UPDATE_SETTINGS";

/**
 * Log an activity for a coach's audit trail.
 */
export async function logActivity(params: {
  coachId: string;
  userId?: string;
  action: ActivityAction;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        coachId: params.coachId,
        userId: params.userId,
        action: params.action,
        details: params.details,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

/**
 * Get recent activity logs for a coach.
 */
export async function getActivityLogs(coachId: string, limit: number = 20) {
  return prisma.activityLog.findMany({
    where: { coachId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Format relative time for display.
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
