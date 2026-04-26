"use client";

/**
 * Send-Test-Notification button.
 *
 * Pings POST /api/push/test which sends "Test notification — Podium is
 * connected." to every active subscription belonging to the current user.
 * Used on athlete + coach notification settings pages so a user can verify
 * the full SW → server → push service → device path on their own device.
 *
 * Disabled when the browser doesn't have a subscription locally — no point
 * sending if nothing is listening on this device. Server still verifies and
 * returns 409 if there are no DB rows either way.
 */

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

export function TestPushButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [hasLocalSub, setHasLocalSub] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setHasLocalSub(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setHasLocalSub(sub !== null))
      .catch(() => setHasLocalSub(false));
  }, []);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { ...csrfHeaders() },
      });
      const payload = (await res.json().catch(() => null)) as {
        success: boolean;
        error?: string;
        data?: { delivered: number };
      } | null;

      if (!res.ok || !payload?.success) {
        toast.error(
          "Test notification didn't go out",
          payload?.error ?? "Try enabling push and reloading."
        );
        return;
      }

      toast.success(
        "Test sent",
        `Delivered to ${payload.data?.delivered ?? 1} device${
          (payload.data?.delivered ?? 1) === 1 ? "" : "s"
        }.`
      );
    } catch (err) {
      logger.debug("test push failed", {
        context: "ui/TestPushButton",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
      toast.error("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Hide entirely until we know whether the device has a subscription.
  if (hasLocalSub === null) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      loading={busy}
      disabled={busy || !hasLocalSub}
      title={
        hasLocalSub ? "Send a test notification to this device" : "Enable push above to send a test"
      }
    >
      <Send size={14} strokeWidth={1.75} aria-hidden="true" />
      Send test notification
    </Button>
  );
}
