"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { clearAllClientStateForUser } from "@/lib/client-state-cleanup";
import { logger } from "@/lib/logger";

export function LogoutButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    // Mirror DashboardLayout: clear per-user client state before the network
    // call so a logout that times out still leaves no PII on the device.
    await clearAllClientStateForUser(userId);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: csrfHeaders() });
    } catch (err) {
      // ok: best-effort — we reload regardless, so the worst case is a stale
      // session cookie that next page load will rehydrate or invalidate.
      logger.debug("logout fetch failed; reloading anyway", {
        context: "src/app/athletes/claim/[token]/_logout-button.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
    // Hard reload so the server component re-runs and re-evaluates session.
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="btn-secondary w-full justify-center text-sm gap-2 disabled:opacity-60"
    >
      <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
