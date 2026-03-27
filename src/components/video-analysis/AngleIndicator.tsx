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

const STATUS_COLORS: Record<AngleStatus, { text: string; bg: string; glow: string }> = {
  optimal: {
    text: "text-success-500",
    bg: "bg-success-500/10",
    glow: "shadow-[0_0_8px_rgba(0,255,136,0.15)]",
  },
  marginal: {
    text: "text-warning-500",
    bg: "bg-warning-500/10",
    glow: "shadow-[0_0_8px_rgba(255,136,0,0.15)]",
  },
  concerning: {
    text: "text-danger-500",
    bg: "bg-danger-500/10",
    glow: "shadow-[0_0_8px_rgba(255,34,34,0.15)]",
  },
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function AngleIndicator({ label, degrees, status, compact = false }: Props) {
  const colors = STATUS_COLORS[status];

  if (compact) {
    return (
      <div className={`flex items-center justify-between px-2 py-1 rounded ${colors.bg}`}>
        <span className="text-xs text-muted truncate">{label}</span>
        <span className={`text-xs font-bold tabular-nums font-mono ${colors.text}`}>
          {degrees}°
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 ${colors.bg} ${colors.glow} transition-all duration-200`}>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums font-mono ${colors.text}`}>
        {degrees}°
      </p>
    </div>
  );
}
