"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StreakBadge } from "./StreakBadge";
import { Activity, Bell, Calendar, TrendingUp } from "lucide-react";

export interface DashboardWidgetProps {
  /** Current readiness score (0-10) */
  readiness?: number | null;
  /** Training streak in days */
  streakDays?: number;
  /** Next session label */
  nextSession?: string | null;
  /** Unread notification count */
  notificationCount?: number;
  /** Show skeleton loading state */
  loading?: boolean;
  className?: string;
}

/**
 * Compact hero card for coach/athlete dashboards.
 * Gradient background with key metrics at a glance.
 * When `loading` transitions from true→false, content fades in with a slide-up.
 */
export function DashboardWidget({
  readiness,
  streakDays = 0,
  nextSession,
  notificationCount = 0,
  loading = false,
  className,
}: DashboardWidgetProps) {
  const [phase, setPhase] = useState<"loading" | "entering" | "visible">(
    loading ? "loading" : "visible"
  );
  const reducedMotion = useRef(false);
  const wasLoading = useRef(loading);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (wasLoading.current && !loading) {
      if (reducedMotion.current) {
        setPhase("visible");
      } else {
        setPhase("entering");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setPhase("visible"));
        });
      }
    } else if (!loading) {
      setPhase("visible");
    }
    wasLoading.current = loading;
  }, [loading]);

  const readinessColor =
    readiness == null
      ? "text-surface-400"
      : readiness >= 8
      ? "text-emerald-400"
      : readiness >= 5
      ? "text-amber-400"
      : "text-red-400";

  const contentStyle: React.CSSProperties | undefined =
    reducedMotion.current || phase === "visible"
      ? phase === "visible"
        ? { opacity: 1, transform: "translateY(0)", transition: "opacity 250ms ease-out, transform 250ms ease-out" }
        : undefined
      : {
          opacity: 0,
          transform: "translateY(8px)",
        };

  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden p-6",
        "bg-gradient-to-br from-amber-500/10 via-surface-900/80 to-surface-950",
        "border border-surface-800/50",
        className
      )}
    >
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
        aria-hidden="true"
      />

      {loading ? (
        /* Skeleton state */
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shimmer shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-12 shimmer rounded" />
                <div className="h-2.5 w-16 shimmer rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4" style={contentStyle}>
          {/* Readiness */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60 flex items-center justify-center shrink-0">
              <Activity size={18} strokeWidth={2} className={readinessColor} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-lg font-bold tabular-nums font-heading", readinessColor)}>
                {readiness != null ? readiness.toFixed(1) : "—"}
              </p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Readiness</p>
            </div>
          </div>

          {/* Streak */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60 flex items-center justify-center shrink-0">
              <TrendingUp size={18} strokeWidth={2} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              {streakDays > 0 ? (
                <StreakBadge days={streakDays} isActive />
              ) : (
                <>
                  <p className="text-lg font-bold tabular-nums font-heading text-surface-400">0</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider">Streak</p>
                </>
              )}
            </div>
          </div>

          {/* Next session */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60 flex items-center justify-center shrink-0">
              <Calendar size={18} strokeWidth={2} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                {nextSession ?? "None"}
              </p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Next Session</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60 flex items-center justify-center shrink-0 relative">
              <Bell size={18} strokeWidth={2} className="text-surface-400" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1 tabular-nums">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold tabular-nums font-heading text-[var(--foreground)]">
                {notificationCount}
              </p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Unread</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
