"use client";

import { useState } from "react";
import { MapPin, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import type { ThrowAngles } from "@/lib/pose-angles";
import { getAnglesWithStatus } from "@/lib/pose-angles";
import { formatTimestamp } from "@/components/video/types";
import { AngleIndicator } from "./AngleIndicator";

/* ─── Types ────────────────────────────────────────────────────────────────── */

export type KeyPosition = {
  id: string;
  timestamp: number;
  label: string;
  angles: ThrowAngles;
  notes: string;
};

type Props = {
  positions: KeyPosition[];
  currentTime: number;
  currentAngles: ThrowAngles | null;
  isDetecting: boolean;
  onMark: (label: string) => void;
  onDelete: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onSeek: (timestamp: number) => void;
};

/* ─── Position Labels ──────────────────────────────────────────────────────── */

const POSITION_LABELS = [
  "Power Position",
  "Release",
  "Block",
  "Entry",
  "Recovery",
  "Custom",
] as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export function KeyPositionsPanel({
  positions,
  currentTime,
  currentAngles,
  isDetecting,
  onMark,
  onDelete,
  onUpdateNotes,
  onSeek,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("Power Position");

  return (
    <div className="space-y-4">
      {/* Mark Position Controls */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
          Mark Position
        </p>

        {/* Label selector */}
        <div className="flex flex-wrap gap-1.5">
          {POSITION_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedLabel(label)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedLabel === label
                  ? "bg-primary-500/20 text-primary-500 border border-primary-500/30"
                  : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mark button */}
        <button
          type="button"
          onClick={() => onMark(selectedLabel)}
          disabled={!isDetecting || !currentAngles}
          className="btn-primary w-full text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <MapPin size={14} strokeWidth={2} aria-hidden="true" />
          Mark &ldquo;{selectedLabel}&rdquo; at {formatTimestamp(currentTime)}
        </button>

        {!isDetecting && (
          <p className="text-xs text-muted text-center">
            Enable pose detection to mark positions
          </p>
        )}
      </div>

      {/* Saved Positions */}
      {positions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
            Saved Positions ({positions.length})
          </p>

          <div className="space-y-1.5">
            {positions.map((pos) => {
              const isExpanded = expandedId === pos.id;
              const angles = getAnglesWithStatus(pos.angles);
              const primaryKeys = ["shoulderSeparation", "hipShoulderDifferential", "blockLegKnee", "trunkLean"];
              const primaryAngles = angles.filter((a) => primaryKeys.includes(a.key));

              return (
                <div
                  key={pos.id}
                  className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    {/* Click to jump to position */}
                    <button
                      type="button"
                      onClick={() => onSeek(pos.timestamp)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 rounded transition-colors px-1 py-0.5"
                      aria-label={`Jump to ${pos.label} at ${formatTimestamp(pos.timestamp)}`}
                    >
                      <MapPin size={14} strokeWidth={2} className="text-primary-500 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {pos.label}
                      </span>
                      <span className="text-xs text-muted tabular-nums font-mono">
                        {formatTimestamp(pos.timestamp)}
                      </span>
                    </button>

                    {/* Expand/collapse */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : pos.id)}
                      className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                      aria-label={isExpanded ? "Collapse details" : "Expand details"}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        size={14}
                        strokeWidth={2}
                        className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDelete(pos.id)}
                      className="p-1 rounded hover:bg-danger-500/10 text-surface-400 hover:text-danger-500 transition-colors"
                      aria-label={`Delete ${pos.label} position`}
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-surface-200 dark:border-surface-700">
                      {/* Key angles */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {primaryAngles.map((angle) => (
                          <AngleIndicator
                            key={angle.key}
                            label={angle.label}
                            degrees={angle.degrees}
                            status={angle.status}
                            compact
                          />
                        ))}
                      </div>

                      {/* Notes */}
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <MessageSquare size={12} strokeWidth={2} className="text-muted" aria-hidden="true" />
                          <span className="text-[10px] text-muted uppercase font-semibold tracking-wider">Notes</span>
                        </div>
                        <textarea
                          value={pos.notes}
                          onChange={(e) => onUpdateNotes(pos.id, e.target.value)}
                          placeholder="Add notes about this position…"
                          className="input text-xs min-h-[60px] resize-y"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {positions.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-muted">
            No positions marked yet. Play the video and mark key throw positions.
          </p>
        </div>
      )}
    </div>
  );
}
