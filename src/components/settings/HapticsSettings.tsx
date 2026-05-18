"use client";

/**
 * HapticsSettings — single toggle for the master "Haptics" preference.
 *
 * Hydrates from /api/athlete/notification-preferences on mount. Writes both
 * to the API (cross-device sync) and to localStorage via setHapticPreference
 * (so the lib gates the next buzz instantly, without a round trip).
 *
 * When the device doesn't support the Vibration API at all, the toggle is
 * disabled and the row explains why — better than an unresponsive switch
 * with no signal.
 */

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { setHapticPreference, isVibrationSupported, haptic } from "@/lib/haptic";

export function HapticsSettings() {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [supported, setSupported] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isVibrationSupported());

    (async () => {
      try {
        const res = await fetch("/api/athlete/notification-preferences", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as
          | { success: true; data: { preferences: { haptics?: { enabled?: boolean } } } }
          | { success: false; error: string };
        if (!payload.success) return;
        const next = payload.data.preferences.haptics?.enabled !== false;
        setEnabled(next);
        setHapticPreference(next);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function toggle() {
    if (saving) return;
    const previous = enabled;
    const next = !previous;

    // Optimistic UI + immediate local-cache write so the next buzz reflects
    // the new state without waiting on the network.
    setEnabled(next);
    setHapticPreference(next);
    setSaving(true);
    setError(null);

    // Confirmation pulse — but only when turning ON. Buzzing on the way OUT
    // would contradict the gesture.
    if (next) haptic.light();

    try {
      const res = await fetch("/api/athlete/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ haptics: { enabled: next } }),
      });
      if (!res.ok) {
        setEnabled(previous);
        setHapticPreference(previous);
        setError("Couldn't save. Try again.");
      }
    } catch {
      setEnabled(previous);
      setHapticPreference(previous);
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const description = !supported
    ? "Your device doesn't support haptic feedback."
    : enabled
      ? "Subtle buzzes on key actions — log a throw, set a PR, extend a streak."
      : "Silent. No vibrations on any action.";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Haptics</h2>
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
              enabled && supported ? "bg-primary-500/15" : "bg-surface-100 dark:bg-surface-800"
            }`}
          >
            <Smartphone
              className={`h-5 w-5 ${enabled && supported ? "text-primary-500" : "text-muted"}`}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">Haptic feedback</p>
            <p className="text-xs text-muted mt-0.5">{description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Haptic feedback"
            disabled={!loaded || saving || !supported}
            onClick={toggle}
            className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
              enabled && supported ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700"
            } ${saving || !supported ? "opacity-60" : ""}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </div>
    </section>
  );
}
