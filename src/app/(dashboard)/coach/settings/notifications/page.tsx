import { redirect } from "next/navigation";
import { ChevronLeft, Bell } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseCoachPrefs } from "@/lib/notifications/coach-preferences";
import { NotificationPreferencesClient } from "./_notifications-client";
import { DeliveryPreferencesSection } from "@/components/delivery-preferences-section";

export const metadata = { title: "Notifications — Podium Throws" };

export default async function CoachNotificationsSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "COACH") {
    redirect("/login");
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: user.userId },
    select: { notificationPreferences: true },
  });
  if (!coach) redirect("/login");

  const preferences = parseCoachPrefs(coach.notificationPreferences);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/coach/settings"
          className="p-2 -ml-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back to settings"
        >
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Bell size={24} className="text-primary-500" strokeWidth={1.75} aria-hidden="true" />
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Notifications</h1>
      </div>

      <DeliveryPreferencesSection />

      <NotificationPreferencesClient initialPreferences={preferences} />
    </div>
  );
}
