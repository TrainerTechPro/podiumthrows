"use client";

/**
 * EnablePushNotifications
 *
 * Handles the full Web Push permission + subscription flow.
 *
 * Props:
 *   variant   — "card" shows the full value-proposition UI (onboarding);
 *               "compact" renders just a small inline button (settings page).
 *   onComplete — called after a successful subscription.
 *   showSkip   — render a "Maybe Later" / "Skip" escape hatch.
 *   onSkip     — called when the user chooses to skip.
 */

import { useEffect, useState, useCallback } from "react";
import { BellRing, BellOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type PermissionState = "unsupported" | "default" | "granted" | "denied";
type SubscriptionState = "unknown" | "subscribed" | "unsubscribed";

export type Props = {
  variant?: "card" | "compact";
  onComplete?: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function EnablePushNotifications({
  variant = "card",
  onComplete,
  showSkip = false,
  onSkip,
}: Props) {
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [subState, setSubState] = useState<SubscriptionState>("unknown");
  const [busy, setBusy] = useState(false);

  /* ── Detect initial state ───────────────────────────────────────────── */

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);

    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          setSubState(sub ? "subscribed" : "unsubscribed");
        })
        .catch(() => setSubState("unsubscribed"));
    }
  }, []);

  /* ── Subscribe flow ─────────────────────────────────────────────────── */

  const subscribeToPush = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 1. Ask permission if not yet granted
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result as PermissionState);
        if (result !== "granted") {
          setBusy(false);
          return;
        }
      }

      // 2. Get SW registration
      const registration = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const vapidRes = await fetch("/api/push/vapid-key");
      if (!vapidRes.ok) {
        toast.error("Push notifications are not available right now.");
        setBusy(false);
        return;
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey: string };

      // 4. Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 5. Save to backend
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!saveRes.ok) {
        toast.error("Couldn't save your subscription. Try again.");
        setBusy(false);
        return;
      }

      setSubState("subscribed");
      toast.success("Notifications enabled!");
      onComplete?.();
    } catch (err) {
      // User dismissed the permission prompt — browser throws NotAllowedError
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError") {
        setPermission("denied");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, onComplete, toast]);

  /* ── Unsubscribe flow ───────────────────────────────────────────────── */

  const unsubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubState("unsubscribed");
      setPermission("default");
      toast.info("Notifications disabled.");
    } catch {
      toast.error("Couldn't disable notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, toast]);

  /* ══════════════════════════════════════════════════════════════════════
     COMPACT VARIANT — inline button for the settings page
  ══════════════════════════════════════════════════════════════════════ */

  if (variant === "compact") {
    if (permission === "unsupported") {
      return (
        <p className="text-xs text-muted">
          Push notifications are not supported by this browser.
        </p>
      );
    }

    if (permission === "denied") {
      return (
        <div className="flex items-start gap-2 rounded-lg bg-surface-100 dark:bg-surface-800 px-4 py-3">
          <BellOff
            size={16}
            strokeWidth={1.75}
            className="text-muted shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs text-muted leading-relaxed">
            Notifications are blocked. Open your browser or OS settings to re-enable
            them for this site.
          </p>
        </div>
      );
    }

    if (permission === "granted" && subState === "subscribed") {
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2
              size={16}
              strokeWidth={1.75}
              className="text-success-500 shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm text-[var(--foreground)]">
              Push notifications enabled
            </span>
          </div>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={busy}
            className="text-xs text-muted hover:text-danger-500 transition-colors disabled:opacity-50"
          >
            {busy ? "Disabling…" : "Disable"}
          </button>
        </div>
      );
    }

    // default or granted-but-unsubscribed
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={subscribeToPush}
        loading={busy}
        disabled={busy}
      >
        <BellRing size={14} strokeWidth={1.75} aria-hidden="true" />
        Enable Push Notifications
      </Button>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     CARD VARIANT — full value-proposition UI for onboarding
  ══════════════════════════════════════════════════════════════════════ */

  /* Unsupported browser */
  if (permission === "unsupported") {
    return (
      <div className="card p-6 sm:p-8 text-center space-y-4">
        <BellOff size={40} strokeWidth={1.5} className="mx-auto text-muted" aria-hidden="true" />
        <p className="text-sm text-muted">
          Push notifications are not supported in this browser. You can still receive
          in-app alerts.
        </p>
        {showSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted hover:text-[var(--foreground)] transition-colors"
          >
            Continue anyway
          </button>
        )}
      </div>
    );
  }

  /* Permission denied */
  if (permission === "denied") {
    return (
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0">
            <BellOff size={24} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
              Notifications are blocked
            </h2>
            <p className="text-sm text-muted mt-0.5">
              To enable them, open your browser or OS settings and allow notifications
              for this site. Then come back here.
            </p>
          </div>
        </div>
        {showSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted hover:text-[var(--foreground)] transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    );
  }

  /* Already subscribed */
  if (permission === "granted" && subState === "subscribed") {
    return (
      <div className="card p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} strokeWidth={1.5} className="text-success-500" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
            You&apos;re all set!
          </h2>
          <p className="text-sm text-muted mt-1">
            Push notifications are enabled. You&apos;ll hear from us when it matters.
          </p>
        </div>
        {showSkip && (
          <Button variant="primary" size="lg" onClick={onComplete} className="min-w-[200px]">
            Continue
          </Button>
        )}
      </div>
    );
  }

  /* Default / unsubscribed — main CTA */
  return (
    <div className="card overflow-hidden">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-amber-600 px-6 py-8 sm:px-8 sm:py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-4">
          <BellRing size={32} strokeWidth={1.5} className="text-white" aria-hidden="true" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
          Stay in the loop
        </h2>
        <p className="text-white/80 mt-2 text-sm sm:text-base max-w-sm mx-auto">
          Get notified when your coach leaves feedback and when teammates hit PRs.
        </p>
      </div>

      {/* Body */}
      <div className="px-6 py-7 sm:px-8 space-y-6">
        {/* Value bullets */}
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center text-base shrink-0"
              aria-hidden="true"
            >
              💬
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Coach feedback on your throws
              </p>
              <p className="text-xs text-muted">
                Instant alert when your coach posts notes or corrections
              </p>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center text-base shrink-0"
              aria-hidden="true"
            >
              🔥
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Teammate personal records
              </p>
              <p className="text-xs text-muted">
                Know when a training partner breaks a barrier
              </p>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center text-base shrink-0"
              aria-hidden="true"
            >
              📅
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Practice reminders 30 min before
              </p>
              <p className="text-xs text-muted">
                Never be late to the throwing circle
              </p>
            </div>
          </li>
        </ul>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={subscribeToPush}
            loading={busy}
            disabled={busy}
            className="w-full"
          >
            Enable Notifications
          </Button>
          {showSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-muted hover:text-[var(--foreground)] transition-colors py-2"
            >
              Maybe Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
