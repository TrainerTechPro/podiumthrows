import { redirect } from "next/navigation";
import { ChevronLeft, Bell } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseCoachPrefs } from "@/lib/notifications/coach-preferences";
import { NotificationPreferencesClient } from "./_notifications-client";
import { DeliveryPreferencesSection } from "@/components/delivery-preferences-section";
import { EnablePushNotifications } from "@/components/notifications/EnablePushNotifications";
import { TestPushButton } from "@/components/notifications/TestPushButton";

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

      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Push subscription
        </h2>
        <p className="text-xs text-muted">
          Subscribe this browser to receive push notifications. The channel toggles below control
          which categories actually fire once subscribed.
        </p>
        <EnablePushNotifications variant="compact" />
        <div className="pt-2 border-t border-[var(--card-border)]">
          <TestPushButton />
        </div>
      </section>

      <DeliveryPreferencesSection />

      <NotificationPreferencesClient initialPreferences={preferences} />
    </div>
  );
}
