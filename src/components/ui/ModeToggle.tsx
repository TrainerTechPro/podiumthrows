"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

interface ModeToggleProps {
  activeMode: "COACH" | "TRAINING";
  className?: string;
}

export function ModeToggle({ activeMode, className }: ModeToggleProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(mode: "COACH" | "TRAINING") {
    if (mode === activeMode || switching) return;
    setSwitching(true);
    try {
      await fetch("/api/user/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mode }),
      });
      router.push(mode === "COACH" ? "/coach/dashboard" : "/athlete/dashboard");
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className={cn("flex rounded-xl bg-[var(--muted-bg)] p-1 gap-1", className)}>
      {(["COACH", "TRAINING"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => handleSwitch(mode)}
          disabled={switching}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
            activeMode === mode
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-card"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          {mode === "COACH" ? "Coach" : "Training"}
        </button>
      ))}
    </div>
  );
}
