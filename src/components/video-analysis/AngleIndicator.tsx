"use client";

import type { AngleStatus } from "@/lib/pose-angles";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Props = {
  label: string;
  degrees: number;
  status: AngleStatus;
  compact?: boolean;
};

/* ─── Status Colors ────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<AngleStatus, { text: string; bg: string; glow: string; label: string }> = {
  optimal: {
    text: "text-success-500",
    bg: "bg-success-500/10",
    glow: "shadow-[0_0_8px_rgba(0,255,136,0.15)]",
    label: "✓",
  },
  marginal: {
    text: "text-warning-500",
    bg: "bg-warning-500/10",
    glow: "shadow-[0_0_8px_rgba(255,136,0,0.15)]",
    label: "~",
  },
  concerning: {
    text: "text-danger-500",
    bg: "bg-danger-500/10",
    glow: "shadow-[0_0_8px_rgba(255,34,34,0.15)]",
    label: "!",
  },
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function AngleIndicator({ label, degrees, status, compact = false }: Props) {
  const colors = STATUS_COLORS[status];

  if (compact) {
    return (
      <div className={`flex items-center justify-between px-2 py-1 rounded ${colors.bg}`} aria-label={`${label}: ${degrees}° (${status})`}>
        <span className="text-xs text-muted truncate">{label}</span>
        <span className="flex items-center gap-1">
          <span className={`text-[10px] font-bold ${colors.text}`} aria-hidden="true">{colors.label}</span>
          <span className={`text-xs font-bold tabular-nums font-mono ${colors.text}`}>
            {degrees}°
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 ${colors.bg} ${colors.glow} transition-all duration-200`} aria-label={`${label}: ${degrees}° (${status})`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
          {label}
        </p>
        <span className={`text-[10px] font-bold ${colors.text}`} aria-hidden="true">{colors.label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums font-mono ${colors.text}`}>
        {degrees}°
      </p>
    </div>
  );
}
