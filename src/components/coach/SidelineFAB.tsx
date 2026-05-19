"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Smartphone } from "lucide-react";
import { setCoachMobileView } from "@/app/(dashboard)/coach/sideline/_actions";

// Flag-gating happens at coach/layout.tsx — if `coachSideline` is off, the
// FAB simply isn't mounted. This component assumes the flag is on.

const COOKIE_NAME = "coach_mobile_view";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function SidelineFAB() {
  const pathname = usePathname();
  const [view, setView] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setView(readCookie(COOKIE_NAME));
  }, [pathname]);

  const onSidelineRoute = pathname?.startsWith("/coach/sideline");
  if (view !== "full" || onSidelineRoute) return null;

  function returnToSideline() {
    startTransition(() => {
      void setCoachMobileView("sideline");
    });
  }

  return (
    <button
      type="button"
      onClick={returnToSideline}
      disabled={pending}
      aria-label="Return to sideline"
      className="md:hidden fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 bg-primary-500 text-surface-950 font-semibold text-sm shadow-lg shadow-primary-500/30 active:scale-[0.95] transition-transform disabled:opacity-60 focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Smartphone size={16} strokeWidth={2.25} aria-hidden="true" />
      {pending ? "Switching…" : "Return to sideline"}
    </button>
  );
}
