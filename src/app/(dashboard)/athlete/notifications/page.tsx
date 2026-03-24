import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getNotifications } from "@/lib/notifications";
import { NotificationsClient } from "../../coach/notifications/_notifications-client";

export const metadata = { title: "Notifications — Podium Throws" };

export default async function AthleteNotificationsPage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (!athlete) redirect("/login");

  const { notifications, unreadCount } = await getNotifications(athlete.id, "ATHLETE", { limit: 100 });

  return (
    <NotificationsClient
      initialNotifications={notifications}
      unreadCount={unreadCount}
      role="ATHLETE"
    />
  );
}
