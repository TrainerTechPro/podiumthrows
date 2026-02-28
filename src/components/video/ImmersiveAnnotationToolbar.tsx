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
  canUndo?: boolean;
  canRedo?: boolean;
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

export function ImmersiveAnnotationToolbar({
  activeTool,
  activeColor,
  activeStrokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onClear,
  canUndo = false,
  canRedo = false,
  annotationCount = 0,
}: Props) {
  const [showColors, setShowColors] = useState(false);
  const [showWidths, setShowWidths] = useState(false);

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-black/50 backdrop-blur-xl rounded-2xl p-1.5">
      {/* ── Drawing Tools ─────────────────────────────────────────── */}
      {TOOLS.map(({ tool, label, icon }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
            activeTool === tool
              ? "bg-primary-500/30 text-primary-400 ring-1 ring-primary-500/50"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
          title={label}
        >
          {icon}
        </button>
      ))}

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div className="w-6 h-px bg-white/20 my-0.5" />

      {/* ── Color swatch (expands to picker) ──────────────────────── */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColors(!showColors);
            setShowWidths(false);
          }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
          title="Color"
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-white/40"
            style={{ backgroundColor: activeColor }}
          />
        </button>

        {showColors && (
          <div className="absolute right-full mr-2 top-0 flex flex-col gap-1 bg-black/70 backdrop-blur-xl rounded-xl p-1.5">
            {ANNOTATION_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onColorChange(color);
                  setShowColors(false);
                }}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  activeColor === color
                    ? "border-white scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Stroke width ──────────────────────────────────────────── */}
      <div className="relative">
        <button
          onClick={() => {
            setShowWidths(!showWidths);
            setShowColors(false);
          }}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Stroke width"
        >
          <div
            className="rounded-full bg-white"
            style={{
              width: activeStrokeWidth * 2 + 4,
              height: activeStrokeWidth * 2 + 4,
            }}
          />
        </button>

        {showWidths && (
          <div className="absolute right-full mr-2 top-0 flex flex-col gap-1 bg-black/70 backdrop-blur-xl rounded-xl p-1.5">
            {STROKE_WIDTHS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => {
                  onStrokeWidthChange(value);
                  setShowWidths(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeStrokeWidth === value
                    ? "bg-primary-500/30 text-primary-400"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div className="w-6 h-px bg-white/20 my-0.5" />

      {/* ── Undo ──────────────────────────────────────────────────── */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Undo"
      >
        <UndoIcon />
      </button>

      {/* ── Redo ──────────────────────────────────────────────────── */}
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Redo"
      >
        <RedoIcon />
      </button>

      {/* ── Clear ─────────────────────────────────────────────────── */}
      <button
        onClick={onClear}
        disabled={annotationCount === 0}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-red-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Clear all"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

/* ─── Icons (same as AnnotationToolbar, sized for immersive) ────────────── */

const iconProps = {
  width: 20,
  height: 20,
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
