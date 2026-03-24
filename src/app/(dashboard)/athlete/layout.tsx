import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardLayout, type DashboardUser } from "@/components";
import { getUnreadCount } from "@/lib/notifications";
import { WhoopAutoSync } from "./_whoop-auto-sync";

const WHOOP_STALE_MS = 60 * 60 * 1000; // 1 hour

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isCoachTraining = session.role === "COACH";
  if (session.role !== "ATHLETE" && !isCoachTraining) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      events: true,
      user: { select: { email: true } },
      whoopConnection: { select: { lastSyncAt: true } },
    },
  });

  if (!athlete) {
    redirect(isCoachTraining ? "/coach/dashboard" : "/login");
  }

  // Auto-sync WHOOP if connected and data is stale (>1 hour since last sync)
  const whoopStale =
    athlete.whoopConnection != null &&
    (!athlete.whoopConnection.lastSyncAt ||
      Date.now() - athlete.whoopConnection.lastSyncAt.getTime() > WHOOP_STALE_MS);

  const notificationCount = await getUnreadCount(athlete.id, "ATHLETE");

  const user: DashboardUser = {
    name: `${athlete.firstName} ${athlete.lastName}`,
    email: athlete.user.email,
    role: session.role as "COACH" | "ATHLETE",
    avatarUrl: athlete.avatarUrl ?? undefined,
    activeMode: isCoachTraining ? "TRAINING" : undefined,
    trainingEnabled: isCoachTraining,
  };

  return (
    <DashboardLayout user={user} notificationCount={notificationCount}>
      {whoopStale && <WhoopAutoSync />}
      {children}
    </DashboardLayout>
  );
}
