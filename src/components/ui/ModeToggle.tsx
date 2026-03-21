"use client";

import { useState } from "react";
import { Megaphone, Dumbbell } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

interface ModeToggleProps {
  activeMode: "COACH" | "TRAINING";
  className?: string;
}

export function ModeToggle({ activeMode, className }: ModeToggleProps) {
  const [switching, setSwitching] = useState(false);

  const isCoach = activeMode === "COACH";

  async function toggle() {
    if (switching) return;
    const nextMode = isCoach ? "TRAINING" : "COACH";
    setSwitching(true);
    try {
      const res = await fetch("/api/user/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mode: nextMode }),
      });

      if (!res.ok) {
        setSwitching(false);
        return;
      }

      // Full navigation so server components re-render with the new mode
      window.location.href = nextMode === "COACH" ? "/coach/dashboard" : "/athlete/dashboard";
    } catch {
      setSwitching(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={switching}
      className={`p-3 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 ${className ?? ""}`}
      aria-label={isCoach ? "Switch to Training Mode" : "Switch to Coach Mode"}
      title={isCoach ? "Switch to Training Mode" : "Switch to Coach Mode"}
    >
      {isCoach ? (
        <Megaphone size={20} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Dumbbell size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
