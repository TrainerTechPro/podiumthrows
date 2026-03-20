"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type DashboardMode = "training" | "competition";
export type DashboardDepth = "standard" | "advanced";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 365}`;
}

export function ModeSelector({
  mode,
  depth,
}: {
  mode: DashboardMode;
  depth: DashboardDepth;
}) {
  const router = useRouter();

  function setMode(m: DashboardMode) {
    setCookie("dashboard-mode", m);
    router.refresh();
  }

  function setDepth(d: DashboardDepth) {
    setCookie("dashboard-depth", d);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="inline-flex rounded-lg bg-surface-100 dark:bg-surface-800 p-0.5">
        <button
          onClick={() => setMode("training")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === "training"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          Training Block
        </button>
        <button
          onClick={() => setMode("competition")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === "competition"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          Competition Prep
        </button>
      </div>
      <button
        onClick={() => setDepth(depth === "standard" ? "advanced" : "standard")}
        className="text-[10px] font-medium text-surface-400 hover:text-[var(--foreground)] transition-colors"
      >
        {depth === "standard" ? "Show Advanced" : "Hide Advanced"}
      </button>
    </div>
  );
}
