"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ExtendedBodyPart, Slug } from "react-muscle-highlighter";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/* ─── Dynamic import (no SSR — SVG rendering is client-only) ───────────── */

const Body = dynamic(() => import("react-muscle-highlighter"), { ssr: false });

/* ─── Types ────────────────────────────────────────────────────────────── */

export type SoreArea = {
  region: string;
  slug: Slug;
  side?: "left" | "right";
  severity: 1 | 2 | 3;
};

export interface InteractiveBodyMapProps {
  value: SoreArea[];
  onChange: (areas: SoreArea[]) => void;
  disabled?: boolean;
  className?: string;
}

/* ─── Region ID ↔ Slug Mapping ─────────────────────────────────────────── */
// Maps our BODY_REGIONS ids to react-muscle-highlighter slugs

export const REGION_TO_SLUG: Record<string, { slug: Slug; side?: "left" | "right" }> = {
  neck: { slug: "neck" },
  left_shoulder: { slug: "deltoids", side: "left" },
  right_shoulder: { slug: "deltoids", side: "right" },
  left_elbow: { slug: "forearm", side: "left" },
  right_elbow: { slug: "forearm", side: "right" },
  left_wrist: { slug: "hands", side: "left" },
  right_wrist: { slug: "hands", side: "right" },
  left_hand: { slug: "hands", side: "left" },
  right_hand: { slug: "hands", side: "right" },
  upper_back: { slug: "upper-back" },
  chest: { slug: "chest" },
  lower_back: { slug: "lower-back" },
  abdomen: { slug: "abs" },
  left_hip: { slug: "adductors", side: "left" },
  right_hip: { slug: "adductors", side: "right" },
  glutes: { slug: "gluteal" },
  left_quad: { slug: "quadriceps", side: "left" },
  right_quad: { slug: "quadriceps", side: "right" },
  left_hamstring: { slug: "hamstring", side: "left" },
  right_hamstring: { slug: "hamstring", side: "right" },
  left_knee: { slug: "knees", side: "left" },
  right_knee: { slug: "knees", side: "right" },
  left_shin: { slug: "tibialis", side: "left" },
  right_shin: { slug: "tibialis", side: "right" },
  left_calf: { slug: "calves", side: "left" },
  right_calf: { slug: "calves", side: "right" },
  left_ankle: { slug: "ankles", side: "left" },
  right_ankle: { slug: "ankles", side: "right" },
  left_foot: { slug: "feet", side: "left" },
  right_foot: { slug: "feet", side: "right" },
};

function slugToRegionLabel(slug: Slug, side?: "left" | "right"): string {
  const sideLabel = side === "left" ? "L." : side === "right" ? "R." : "";
  const nameMap: Record<string, string> = {
    neck: "Neck", deltoids: "Shoulder", chest: "Chest", biceps: "Biceps",
    triceps: "Triceps", forearm: "Forearm", hands: "Hand",
    "upper-back": "Upper Back", "lower-back": "Lower Back",
    abs: "Abs", obliques: "Obliques", adductors: "Hip",
    gluteal: "Glutes", quadriceps: "Quad", hamstring: "Hamstring",
    knees: "Knee", tibialis: "Shin", calves: "Calf",
    ankles: "Ankle", feet: "Foot", trapezius: "Traps",
    head: "Head",
  };
  const name = nameMap[slug] ?? slug;
  return sideLabel ? `${sideLabel} ${name}` : name;
}

/* ─── Severity Colors ──────────────────────────────────────────────────── */

const SEVERITY_COLORS = {
  1: "#fbbf24", // mild — yellow
  2: "#f59e0b", // moderate — amber
  3: "#ef4444", // severe — red
} as const;

const SEVERITY_LABELS = {
  1: "Mild",
  2: "Moderate",
  3: "Severe",
} as const;

const SEVERITY_TAG_STYLES = {
  1: "bg-yellow-500/12 text-yellow-400 border-yellow-500/20",
  2: "bg-amber-500/12 text-amber-400 border-amber-500/20",
  3: "bg-red-500/12 text-red-400 border-red-500/20",
} as const;

/* ─── Component ────────────────────────────────────────────────────────── */

export function InteractiveBodyMap({
  value,
  onChange,
  disabled = false,
  className,
}: InteractiveBodyMapProps) {
  const [viewSide, setViewSide] = useState<"front" | "back">("front");

  /* Build the data array for the Body component from our selected areas */
  const bodyData: ExtendedBodyPart[] = useMemo(() => {
    return value.map((area) => ({
      slug: area.slug,
      side: area.side,
      color: SEVERITY_COLORS[area.severity],
      intensity: area.severity,
    }));
  }, [value]);

  /* Handle click — cycle severity: none → mild → moderate → severe → none */
  const handleBodyPartPress = useCallback(
    (part: ExtendedBodyPart, side?: "left" | "right") => {
      if (disabled || !part.slug) return;

      const slug = part.slug;
      const existing = value.find(
        (a) => a.slug === slug && a.side === side
      );

      if (existing) {
        if (existing.severity < 3) {
          // Cycle up
          onChange(
            value.map((a) =>
              a.slug === slug && a.side === side
                ? { ...a, severity: (a.severity + 1) as 1 | 2 | 3 }
                : a
            )
          );
        } else {
          // Remove (was severe, cycle back to none)
          onChange(value.filter((a) => !(a.slug === slug && a.side === side)));
        }
      } else {
        // Add new with mild severity
        const region = slugToRegionLabel(slug, side);
        onChange([
          ...value,
          { region, slug, side, severity: 1 },
        ]);
      }
    },
    [value, onChange, disabled]
  );

  /* Remove a specific area */
  const removeArea = useCallback(
    (slug: Slug, side?: "left" | "right") => {
      onChange(value.filter((a) => !(a.slug === slug && a.side === side)));
    },
    [value, onChange]
  );

  return (
    <div className={cn("space-y-3", className)}>
      {/* Front / Back toggle */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setViewSide("front")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
            viewSide === "front"
              ? "bg-primary-500/15 text-primary-500 border border-primary-500/30"
              : "bg-[var(--muted-bg)] text-muted border border-[var(--card-border)] hover:border-primary-500/30"
          )}
        >
          Front
        </button>
        <button
          type="button"
          onClick={() => setViewSide("back")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
            viewSide === "back"
              ? "bg-primary-500/15 text-primary-500 border border-primary-500/30"
              : "bg-[var(--muted-bg)] text-muted border border-[var(--card-border)] hover:border-primary-500/30"
          )}
        >
          Back
        </button>
      </div>

      {/* Body diagram */}
      <div className="flex justify-center">
        <div className="w-[220px] sm:w-[260px]">
          <Body
            data={bodyData}
            side={viewSide}
            gender="male"
            scale={1}
            onBodyPartPress={handleBodyPartPress}
            border="none"
            defaultFill="#1a1a1e"
            defaultStroke="#27272a"
            defaultStrokeWidth={0.5}
            hiddenParts={["hair", "head"]}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4">
        {([1, 2, 3] as const).map((sev) => (
          <div key={sev} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: SEVERITY_COLORS[sev] }}
            />
            <span className="text-[10px] text-muted font-medium">
              {SEVERITY_LABELS[sev]}
            </span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="text-center text-[10px] text-surface-500">
        Tap a body part to mark soreness. Tap again to increase severity.
      </p>

      {/* Selected area tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {value.map((area) => (
            <span
              key={`${area.slug}-${area.side ?? "center"}`}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border",
                SEVERITY_TAG_STYLES[area.severity]
              )}
            >
              {area.region}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeArea(area.slug, area.side)}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${area.region}`}
                >
                  <X size={12} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
