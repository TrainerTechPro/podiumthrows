"use client";

import Link from "next/link";
import { Video, Clock } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Analysis = {
  id: string;
  title: string;
  event: string;
  status: string;
  thumbnailUrl: string | null;
  createdAt: string;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

/* ─── Event Colors ─────────────────────────────────────────────────────────── */

const EVENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SHOT_PUT: { bg: "bg-[#E85D26]/15", text: "text-[#E85D26]", label: "Shot Put" },
  DISCUS: { bg: "bg-[#2980B9]/15", text: "text-[#2980B9]", label: "Discus" },
  HAMMER: { bg: "bg-[#C0392B]/15", text: "text-[#C0392B]", label: "Hammer" },
  JAVELIN: { bg: "bg-[#2D8A4E]/15", text: "text-[#2D8A4E]", label: "Javelin" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  UPLOADED: { bg: "bg-info-500/15", text: "text-info-500", label: "Uploaded" },
  ANALYZING: { bg: "bg-warning-500/15", text: "text-warning-500", label: "Analyzing" },
  COMPLETED: { bg: "bg-success-500/15", text: "text-success-500", label: "Completed" },
  FAILED: { bg: "bg-danger-500/15", text: "text-danger-500", label: "Failed" },
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function VideoAnalysisCard({ analysis }: { analysis: Analysis }) {
  const eventStyle = EVENT_COLORS[analysis.event] || EVENT_COLORS.SHOT_PUT;
  const statusStyle = STATUS_STYLES[analysis.status] || STATUS_STYLES.UPLOADED;
  const date = new Date(analysis.createdAt);

  return (
    <Link
      href={`/coach/video-analysis/${analysis.id}`}
      className="card card-interactive group block overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-900 relative overflow-hidden">
        {analysis.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={analysis.thumbnailUrl}
            alt={analysis.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video size={32} strokeWidth={1.5} className="text-surface-600" aria-hidden="true" />
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
          {analysis.title}
        </h3>

        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${eventStyle.bg} ${eventStyle.text}`}>
            {eventStyle.label}
          </span>
          <span className="text-xs text-muted truncate">
            {analysis.athlete.firstName} {analysis.athlete.lastName}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted">
          <Clock size={12} strokeWidth={2} aria-hidden="true" />
          <time dateTime={date.toISOString()}>
            {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </time>
        </div>
      </div>
    </Link>
  );
}
