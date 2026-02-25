import { requireCoachSession, getCoachNotifications } from "@/lib/data/coach";
import { redirect } from "next/navigation";
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

  const notifications = await getCoachNotifications(coach.id, { limit: 100 });
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsClient
      initialNotifications={notifications}
      unreadCount={unreadCount}
    />
  );
}
