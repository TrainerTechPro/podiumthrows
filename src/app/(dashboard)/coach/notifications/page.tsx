import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { getNotifications } from "@/lib/notifications";
import { NotificationsClient } from "./_notifications-client";

export const metadata = { title: "Notifications — Podium Throws" };

export default async function CoachNotificationsPage() {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  const { notifications, unreadCount } = await getNotifications(coach.id, "COACH", { limit: 100 });

  return (
    <NotificationsClient
      initialNotifications={notifications}
      unreadCount={unreadCount}
      role="COACH"
    />
  );
}
