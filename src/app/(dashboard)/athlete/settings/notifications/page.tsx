import { redirect } from "next/navigation";
import { ChevronLeft, Bell } from "lucide-react";
import Link from "next/link";
import { requireAthleteSession } from "@/lib/data/athlete";
import { getPushPreferences } from "@/lib/push/preferences";
import { NotificationPreferencesClient } from "./_notification-preferences-client";

export const metadata = { title: "Notifications — Podium Throws" };

export default async function NotificationsSettingsPage() {
  let result: Awaited<ReturnType<typeof requireAthleteSession>>;
  try {
    result = await requireAthleteSession();
  } catch {
    redirect("/login");
  }

  const preferences = await getPushPreferences(result.athlete.id);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/athlete/settings"
          className="p-2 -ml-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back to settings"
        >
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Bell
          size={24}
          className="text-primary-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Notifications
        </h1>
      </div>

      {/* Client section */}
      <NotificationPreferencesClient initialPreferences={preferences} />
    </div>
  );
}
