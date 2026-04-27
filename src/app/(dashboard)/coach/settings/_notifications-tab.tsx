"use client";

import { useEffect, useState } from "react";
import { NotificationPreferencesClient } from "./notifications/_notifications-client";
import { DEFAULT_COACH_PREFS } from "@/lib/notifications/coach-preferences";
import type { CoachNotificationPreferences } from "@/lib/notifications/coach-preferences";
import { DeliveryPreferencesSection } from "@/components/delivery-preferences-section";
import { logger } from "@/lib/logger";

/* ─── Coach notifications tab content ─────────────────────────────────────
   Wraps NotificationPreferencesClient with a client-side initial-prefs
   fetch so the existing component (which expects `initialPreferences` from
   a server boundary) drops cleanly into the consolidated /coach/settings
   page without forcing the parent to become async-server-shaped.
   ────────────────────────────────────────────────────────────────────── */

export function CoachNotificationsTabContent() {
  const [prefs, setPrefs] = useState<CoachNotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach/notification-preferences")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json.data) {
          setPrefs(json.data as CoachNotificationPreferences);
        } else {
          // Fall through to defaults when the API hasn't been seeded yet —
          // the toggle UI still renders and writes will create the row.
          setPrefs(DEFAULT_COACH_PREFS);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        logger.warn("coach notif prefs fetch failed", {
          context: "coach/settings:notifications-tab",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
        setError("Couldn't load notification preferences. Try refreshing.");
        setPrefs(DEFAULT_COACH_PREFS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!prefs) {
    return (
      <div className="card p-5 space-y-3" aria-busy="true">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-warning-500/10 border border-warning-500/30 p-3 text-xs text-warning-700 dark:text-warning-400">
          {error}
        </div>
      )}
      <DeliveryPreferencesSection />
      <NotificationPreferencesClient initialPreferences={prefs} />
    </div>
  );
}
