"use client";

import type { ProgrammedSessionWithDetails } from "@/lib/data/programming";
import { Badge } from "@/components";
import { cn } from "@/lib/utils";

/* ─── Tier color mapping ──────────────────────────────────────────────── */

const tierStyles: Record<"TEAM" | "GROUP" | "INDIVIDUAL", { border: string; bg: string }> = {
  TEAM: {
    border: "border-l-info-500",
    bg: "bg-info-50 dark:bg-info-500/5",
  },
  GROUP: {
    border: "border-l-primary-500",
    bg: "bg-primary-50 dark:bg-primary-500/5",
  },
  INDIVIDUAL: {
    border: "border-l-success-500",
    bg: "bg-success-50 dark:bg-success-500/5",
  },
};

/* ─── Component ───────────────────────────────────────────────────────── */

interface SessionCardProps {
  session: ProgrammedSessionWithDetails;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const tier = session.tier as "TEAM" | "GROUP" | "INDIVIDUAL";
  const style = tierStyles[tier];
  const isInherited = !!session.parentId;
  const hasOverrides = session.overrideCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-xl border-l-4 transition-shadow",
        "cursor-pointer hover:ring-1 hover:ring-primary-500/30",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
        style.bg,
        isInherited ? "border-dashed" : "border-solid",
        style.border
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold text-[var(--foreground)] truncate">
          {session.title}
        </span>
        {hasOverrides && <Badge variant="warning">Override</Badge>}
      </div>

      {/* Template name */}
      <p className="text-xs text-muted truncate mt-0.5">{session.throwsSession.name}</p>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <Badge variant={session.status === "PUBLISHED" ? "success" : "neutral"}>
          {session.status === "PUBLISHED" ? "Published" : "Draft"}
        </Badge>

        {isInherited && <span className="text-xs text-muted">Inherited</span>}
      </div>
    </button>
  );
}
