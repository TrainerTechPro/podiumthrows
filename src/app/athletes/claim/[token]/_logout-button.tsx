"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

/**
 * The claim flow tells a signed-in visitor to log out so they can claim the
 * invited profile under a different account. Previously this was a <Link>
 * pointing at /api/auth/logout — but the route only exports POST, so the
 * GET navigation 405'd and stranded the user. This component POSTs the
 * logout with CSRF, then hard-reloads the same URL so the page re-renders
 * in the unauthenticated branch with the "Set up my account" CTA.
 */
export function LogoutButton({ returnHref }: { returnHref: string }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: csrfHeaders() });
    } catch (err) {
      // ok: best-effort logout — if the POST fails, the hard reload to the
      // claim URL is still the right recovery path (the server-side cookie
      // may already have been cleared mid-request; if not, the claim page
      // re-renders the LoggedInWarning so the user can retry).
      logger.debug("claim logout: fetch failed", { context: "ui", error: err });
    }
    window.location.assign(returnHref);
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="btn-secondary w-full justify-center text-sm gap-2 min-h-[44px] inline-flex items-center"
    >
      <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
