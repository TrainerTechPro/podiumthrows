"use client";

/**
 * Coach notification prefs — per-type in-app toggles.
 *
 * Optimistic UI: toggle state updates immediately, POST in background,
 * rolls back with a toast on failure. Save-in-flight is tracked per-key
 * so rapid toggling on different rows doesn't block each other.
 */

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type {
  CoachNotificationPreferences,
  CoachNotificationType,
} from "@/lib/notifications/coach-preferences";

type GroupedItem = {
  key: CoachNotificationType;
  emoji: string;
  title: string;
  description: string;
};

type Group = {
  heading: string;
  items: GroupedItem[];
};

/**
 * Ordered by operational priority for a coach: first the day-to-day
 * roster signals, then the periodization surfaces, then admin/ops.
 */
const GROUPS: Group[] = [
  {
    heading: "Athletes",
    items: [
      {
        key: "ATHLETE_JOINED",
        emoji: "👤",
        title: "Athlete joins roster",
        description: "When an athlete claims your invite or proxy profile",
      },
      {
        key: "LOW_READINESS",
        emoji: "🔋",
        title: "Low readiness",
        description: "When an athlete checks in with a readiness score below 4",
      },
      {
        key: "PR_ALERT",
        emoji: "🏆",
        title: "Personal best",
        description: "When an athlete hits a new event PR",
      },
    ],
  },
  {
    heading: "Programming",
    items: [
      {
        key: "PROGRAM_CHECKPOINT",
        emoji: "📈",
        title: "Program checkpoint",
        description: "When the engine recommends an adaptation at a weekly checkpoint",
      },
      {
        key: "COMPLEX_ROTATED",
        emoji: "🔄",
        title: "Exercise complex rotated",
        description:
          "When an athlete's complex auto-rotates (45-day rule) or you trigger a rotation",
      },
      {
        key: "PROGRAMMING_REQUESTED",
        emoji: "✉️",
        title: "Programming requested",
        description: "When an athlete requests a new program from you",
      },
    ],
  },
  {
    heading: "Roster admin",
    items: [
      {
        key: "QUESTIONNAIRE_COMPLETE",
        emoji: "📝",
        title: "Questionnaire completed",
        description: "When an athlete finishes a questionnaire you assigned",
      },
      {
        key: "INVITATION_EXPIRED",
        emoji: "⏰",
        title: "Invite expired",
        description: "When an invite lapses before the athlete could claim it",
      },
    ],
  },
];

type Props = {
  initialPreferences: CoachNotificationPreferences;
};

export function NotificationPreferencesClient({ initialPreferences }: Props) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<CoachNotificationPreferences>(initialPreferences);
  const [savingKey, setSavingKey] = useState<CoachNotificationType | null>(null);

  async function toggle(key: CoachNotificationType) {
    if (savingKey) return;
    const previous = prefs.inApp[key];
    const next = !previous;

    setPrefs((p) => ({ ...p, inApp: { ...p.inApp, [key]: next } }));
    setSavingKey(key);

    try {
      const res = await fetch("/api/coach/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ inApp: { [key]: next } }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setPrefs((p) => ({ ...p, inApp: { ...p.inApp, [key]: previous } }));
        toast.error(payload?.error || "Couldn't save preference. Try again.");
      }
    } catch {
      setPrefs((p) => ({ ...p, inApp: { ...p.inApp, [key]: previous } }));
      toast.error("Network error. Try again.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-sm text-muted">
          Toggle which in-app notifications you want to see in the coach tray. Turning one off stops
          both the notification row and the unread badge for that type.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.heading} className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            {group.heading}
          </h2>

          <div className="space-y-0">
            {group.items.map(({ key, emoji, title, description }) => {
              const enabled = prefs.inApp[key];
              const busy = savingKey === key;

              return (
                <div
                  key={key}
                  className="flex items-center gap-3 py-3 border-b border-[var(--card-border)] last:border-b-0"
                >
                  <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-base shrink-0">
                    <span aria-hidden="true">{emoji}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
                    <p className="text-xs text-muted">{description}</p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={title}
                    disabled={busy}
                    onClick={() => toggle(key)}
                    className={[
                      "relative h-6 w-11 rounded-full shrink-0 transition-colors",
                      enabled ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700",
                      busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        enabled ? "translate-x-5" : "translate-x-0",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
