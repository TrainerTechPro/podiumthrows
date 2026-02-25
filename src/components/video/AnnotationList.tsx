"use client";

import { useMemo } from "react";
import {
  type Annotation,
  formatTimestamp,
  isAnnotationVisible,
} from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  annotations: Annotation[];
  currentTime: number;
  isEditing?: boolean;
  onSeek: (time: number) => void;
  onDelete?: (id: string) => void;
  className?: string;
};

/* ─── Type Icons ──────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  line: { label: "Line", icon: <LineIco /> },
  arrow: { label: "Arrow", icon: <ArrowIco /> },
  circle: { label: "Circle", icon: <CircleIco /> },
  angle: { label: "Angle", icon: <AngleIco /> },
  freehand: { label: "Drawing", icon: <FreehandIco /> },
  text: { label: "Text", icon: <TextIco /> },
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AnnotationList({
  annotations,
  currentTime,
  isEditing = false,
  onSeek,
  onDelete,
  className,
}: Props) {
  const sortedAnnotations = useMemo(
    () => [...annotations].sort((a, b) => a.timestamp - b.timestamp),
    [annotations]
  );

  if (annotations.length === 0) {
    return (
      <div className={`text-center py-8 ${className ?? ""}`}>
        <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          </svg>
        </div>
        <p className="text-xs font-medium text-surface-500">No annotations yet</p>
        {isEditing && (
          <p className="text-[10px] text-surface-400 mt-0.5">
            Select a tool and draw on the video
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
          Annotations
        </span>
        <span className="text-[10px] text-surface-400 tabular-nums">
          {annotations.length}
        </span>
      </div>

      {/* List */}
      <div className="space-y-0.5 max-h-[400px] overflow-y-auto custom-scrollbar">
        {sortedAnnotations.map((ann) => {
          const active = isAnnotationVisible(ann, currentTime);
          const typeInfo = TYPE_LABELS[ann.type] ?? {
            label: ann.type,
            icon: null,
          };

          return (
            <button
              key={ann.id}
              onClick={() => onSeek(ann.timestamp)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${
                active
                  ? "bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent"
              }`}
            >
              {/* Type icon */}
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: ann.color + "20",
                  color: ann.color,
                }}
              >
                {typeInfo.icon}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-surface-500 bg-surface-100 dark:bg-surface-800 px-1 py-0.5 rounded">
                    {formatTimestamp(ann.timestamp)}
                  </span>
                  <span className="text-[11px] font-medium text-surface-700 dark:text-surface-300">
                    {typeInfo.label}
                  </span>
                </div>
                {ann.text && (
                  <p className="text-[10px] text-surface-400 truncate mt-0.5">
                    &ldquo;{ann.text}&rdquo;
                  </p>
                )}
              </div>

              {/* Duration badge */}
              <span className="text-[9px] text-surface-400 tabular-nums shrink-0">
                {ann.duration}s
              </span>

              {/* Delete */}
              {isEditing && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(ann.id);
                  }}
                  className="p-0.5 rounded text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Delete annotation"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Mini Icons ──────────────────────────────────────────────────────────── */

const miniProps = {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function LineIco() {
  return (
    <svg {...miniProps}>
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  );
}

function ArrowIco() {
  return (
    <svg {...miniProps}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="12 5 19 5 19 12" />
    </svg>
  );
}

function CircleIco() {
  return (
    <svg {...miniProps}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function AngleIco() {
  return (
    <svg {...miniProps}>
      <polyline points="6 20 6 6 20 20" />
    </svg>
  );
}

function FreehandIco() {
  return (
    <svg {...miniProps}>
      <path d="M3 17c3-3 6 3 9 0s6-6 9-3" />
    </svg>
  );
}

function TextIco() {
  return (
    <svg {...miniProps}>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}
