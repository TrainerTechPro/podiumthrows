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

  // TODO(pagination): wire ?page= + total count so athletes with >100
  // notifications can load older pages. For now show 100 most recent and
  // render a "See older" hint when at the cap. See tasks/harden-athlete-3.md.
  const PAGE_LIMIT = 100;
  const { notifications, unreadCount } = await getNotifications(athlete.id, "ATHLETE", {
    limit: PAGE_LIMIT,
  });
  const mayHaveMore = notifications.length === PAGE_LIMIT;

  return (
    <>
      <NotificationsClient
        initialNotifications={notifications}
        unreadCount={unreadCount}
        role="ATHLETE"
      />
      {mayHaveMore && (
        <p className="text-center text-xs text-muted mt-6 px-4">
          Showing the {PAGE_LIMIT} most recent. Older notifications stay in your history —
          pagination will let you reach them soon.
        </p>
      )}
    </>
  );
}
