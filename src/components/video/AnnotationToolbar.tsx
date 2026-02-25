"use client";

import { useState } from "react";
import {
  type AnnotationTool,
  ANNOTATION_COLORS,
  STROKE_WIDTHS,
} from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  activeTool: AnnotationTool;
  activeColor: string;
  activeStrokeWidth: number;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onSave?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isSaving?: boolean;
  annotationCount?: number;
};

/* ─── Tool Definitions ────────────────────────────────────────────────────── */

const TOOLS: { tool: AnnotationTool; label: string; icon: React.ReactNode }[] = [
  { tool: "select", label: "Select", icon: <SelectIcon /> },
  { tool: "line", label: "Line", icon: <LineIcon /> },
  { tool: "arrow", label: "Arrow", icon: <ArrowIcon /> },
  { tool: "circle", label: "Circle", icon: <CircleIcon /> },
  { tool: "angle", label: "Angle", icon: <AngleIcon /> },
  { tool: "freehand", label: "Draw", icon: <FreehandIcon /> },
  { tool: "text", label: "Text", icon: <TextIcon /> },
];

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AnnotationToolbar({
  activeTool,
  activeColor,
  activeStrokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onClear,
  onSave,
  canUndo = false,
  canRedo = false,
  isSaving = false,
  annotationCount = 0,
}: Props) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="flex items-center gap-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-2 py-1.5 flex-wrap">
      {/* ── Drawing Tools ──────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-r border-surface-200 dark:border-surface-700 pr-2 mr-1">
        {TOOLS.map(({ tool, label, icon }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === tool
                ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                : "text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* ── Colors ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-r border-surface-200 dark:border-surface-700 pr-2 mr-1">
        {ANNOTATION_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              activeColor === color
                ? "border-surface-900 dark:border-white scale-110"
                : "border-transparent hover:scale-110"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* ── Stroke Width ───────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-r border-surface-200 dark:border-surface-700 pr-2 mr-1">
        {STROKE_WIDTHS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onStrokeWidthChange(value)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              activeStrokeWidth === value
                ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                : "text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            }`}
            title={label}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Undo / Redo ────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-r border-surface-200 dark:border-surface-700 pr-2 mr-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          <RedoIcon />
        </button>
      </div>

      {/* ── Clear ──────────────────────────────────────────────────── */}
      <div className="relative">
        {showClearConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-surface-500">Clear all?</span>
            <button
              onClick={() => {
                onClear?.();
                setShowClearConfirm(false);
              }}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-0.5 rounded text-[10px] font-medium text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={annotationCount === 0}
            className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Clear all annotations"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* ── Count ──────────────────────────────────────────────────── */}
      {annotationCount > 0 && (
        <span className="text-[10px] text-surface-400 font-medium tabular-nums mr-2">
          {annotationCount} annotation{annotationCount !== 1 ? "s" : ""}
        </span>
      )}

      {/* ── Save ───────────────────────────────────────────────────── */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function SelectIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg {...iconProps}>
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg {...iconProps}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="12 5 19 5 19 12" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function AngleIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="6 20 6 6 20 20" />
      <path d="M6 14a8 8 0 0 0 5.3 6" />
    </svg>
  );
}

function FreehandIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
