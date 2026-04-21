"use client";

/**
 * Delivery channels + quiet hours + per-type overrides for the user-level
 * NotificationPreference model (§spec 2.3.2, 2.5).
 *
 * This is intentionally separate from the existing coach in-app per-type
 * prefs (src/lib/notifications/coach-preferences.ts). Those gate WHETHER
 * notifications fire at all for a given event type — we gate HOW they
 * reach the user once fired (push vs email vs in-app, quiet hours).
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { Bell, Mail, Smartphone, Moon } from "lucide-react";

type Channels = "push" | "email" | "inApp";

type DeliveryPrefs = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  typeOverrides: Record<string, Partial<Record<Channels, boolean>>>;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
};

const DEFAULTS: DeliveryPrefs = {
  pushEnabled: true,
  emailEnabled: true,
  inAppEnabled: true,
  typeOverrides: {},
  quietStart: "22:00",
  quietEnd: "07:00",
  timezone: null,
};

export function DeliveryPreferencesSection() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<DeliveryPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  /* ─── Load ─── */
  useEffect(() => {
    let aborted = false;
    fetch("/api/notifications/preferences", { credentials: "include" })
      .then((r) => r.json())
      .then((payload) => {
        if (aborted) return;
        if (payload?.success && payload.data) {
          setPrefs({
            pushEnabled: !!payload.data.pushEnabled,
            emailEnabled: !!payload.data.emailEnabled,
            inAppEnabled: !!payload.data.inAppEnabled,
            typeOverrides: payload.data.typeOverrides ?? {},
            quietStart: payload.data.quietStart,
            quietEnd: payload.data.quietEnd,
            timezone: payload.data.timezone,
          });
        }
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, []);

  /* ─── Save helper (optimistic) ─── */
  const save = useCallback(
    async (patch: Partial<DeliveryPrefs>, key: string) => {
      const prev = prefs;
      const next = { ...prev, ...patch };
      setPrefs(next);
      setSaving(key);
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(patch),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.success) {
          setPrefs(prev);
          toast.error(payload?.error ?? "Couldn't save preference.");
        }
      } catch {
        setPrefs(prev);
        toast.error("Network error. Try again.");
      } finally {
        setSaving(null);
      }
    },
    [prefs, toast]
  );

  /* ─── Renders ─── */
  if (loading) {
    return <div className="card p-5 shimmer-contextual h-32" aria-label="Loading preferences" />;
  }

  const commentOverride = prefs.typeOverrides.COMMENT_ADDED ?? {};

  return (
    <div className="space-y-4">
      {/* Channels */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Delivery channels
        </h2>
        <p className="text-xs text-muted mb-4">
          Turn off a channel to silence it everywhere. Fine-tune individual categories below.
        </p>
        <ToggleRow
          icon={<Smartphone size={18} strokeWidth={1.75} aria-hidden="true" />}
          title="Push notifications"
          description="Delivered to your phone or browser."
          enabled={prefs.pushEnabled}
          busy={saving === "pushEnabled"}
          onToggle={() => void save({ pushEnabled: !prefs.pushEnabled }, "pushEnabled")}
        />
        <ToggleRow
          icon={<Mail size={18} strokeWidth={1.75} aria-hidden="true" />}
          title="Email"
          description="Sent to the address on your account."
          enabled={prefs.emailEnabled}
          busy={saving === "emailEnabled"}
          onToggle={() => void save({ emailEnabled: !prefs.emailEnabled }, "emailEnabled")}
        />
        <ToggleRow
          icon={<Bell size={18} strokeWidth={1.75} aria-hidden="true" />}
          title="In-app"
          description="Shown in your notification tray."
          enabled={prefs.inAppEnabled}
          busy={saving === "inAppEnabled"}
          onToggle={() => void save({ inAppEnabled: !prefs.inAppEnabled }, "inAppEnabled")}
        />
      </section>

      {/* Comments — per-type overrides */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">Comments</h2>
        <p className="text-xs text-muted mb-4">
          Fine-tune how comment notifications reach you. Global channel switches above take
          precedence.
        </p>
        <ChannelOverrideRow
          label="Push"
          value={commentOverride.push ?? true}
          disabled={!prefs.pushEnabled}
          onChange={(v) =>
            void save(
              {
                typeOverrides: {
                  ...prefs.typeOverrides,
                  COMMENT_ADDED: { ...commentOverride, push: v },
                },
              },
              "COMMENT_ADDED.push"
            )
          }
        />
        <ChannelOverrideRow
          label="Email"
          value={commentOverride.email ?? true}
          disabled={!prefs.emailEnabled}
          onChange={(v) =>
            void save(
              {
                typeOverrides: {
                  ...prefs.typeOverrides,
                  COMMENT_ADDED: { ...commentOverride, email: v },
                },
              },
              "COMMENT_ADDED.email"
            )
          }
        />
      </section>

      {/* Quiet hours */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
          <Moon size={14} strokeWidth={1.75} aria-hidden="true" />
          Quiet hours
        </h2>
        <p className="text-xs text-muted mb-4">
          Push notifications are silenced between these hours. Email and in-app are unaffected.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <TimeInput
            label="From"
            value={prefs.quietStart ?? ""}
            onCommit={(v) => void save({ quietStart: v || null }, "quietStart")}
          />
          <TimeInput
            label="Until"
            value={prefs.quietEnd ?? ""}
            onCommit={(v) => void save({ quietEnd: v || null }, "quietEnd")}
          />
        </div>
      </section>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function ToggleRow({
  icon,
  title,
  description,
  enabled,
  busy,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--card-border)] last:border-b-0">
      <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0 text-muted">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <Switch enabled={enabled} busy={busy} label={title} onToggle={onToggle} />
    </div>
  );
}

function ChannelOverrideRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-3 border-b border-[var(--card-border)] last:border-b-0 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {disabled && (
          <p className="text-xs text-muted">
            Enable the {label.toLowerCase()} channel above first.
          </p>
        )}
      </div>
      <Switch
        enabled={value && !disabled}
        busy={false}
        label={`Comments · ${label}`}
        onToggle={() => !disabled && onChange(!value)}
      />
    </div>
  );
}

function Switch({
  enabled,
  busy,
  label,
  onToggle,
}: {
  enabled: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
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
  );
}

function TimeInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="time"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        className="input text-sm font-mono tabular-nums"
      />
    </label>
  );
}
