import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getNotifications } from "@/lib/notifications";
import { NotificationsClient } from "../../coach/notifications/_notifications-client";

export const metadata = { title: "Notifications — Podium Throws" };

export default async function AthleteNotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canActAsAthlete(session))) redirect("/coach/dashboard");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (!athlete) redirect("/login");

  const { notifications, nextCursor, unreadCount } = await getNotifications(athlete.id, "ATHLETE", {
    limit: 50,
  });

  return (
    <NotificationsClient
      initialNotifications={notifications}
      initialNextCursor={nextCursor}
      initialUnreadCount={unreadCount}
      role="ATHLETE"
    />
  );
}
