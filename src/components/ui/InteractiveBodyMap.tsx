"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
    neck: "Neck",
    deltoids: "Shoulder",
    chest: "Chest",
    biceps: "Biceps",
    triceps: "Triceps",
    forearm: "Forearm",
    hands: "Hand",
    "upper-back": "Upper Back",
    "lower-back": "Lower Back",
    abs: "Abs",
    obliques: "Obliques",
    adductors: "Hip",
    gluteal: "Glutes",
    quadriceps: "Quad",
    hamstring: "Hamstring",
    knees: "Knee",
    tibialis: "Shin",
    calves: "Calf",
    ankles: "Ankle",
    feet: "Foot",
    trapezius: "Traps",
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
  const svgContainerRef = useRef<HTMLDivElement>(null);

  /* Build the data array for the Body component from our selected areas.
   *
   * The library (react-muscle-highlighter) keys its internal map by `slug`
   * only — so if we pass two entries with the same slug (e.g. left quad +
   * right quad) the second silently overwrites the first, and only one side
   * highlights.  Additionally, its left/right path renderer uses `find()` on
   * the raw data array which also only ever returns one result.
   *
   * Fix: when BOTH sides of a bilateral muscle are selected, collapse them
   * into a single entry with `side` omitted.  The library interprets a missing
   * `side` as "color both left and right paths", which is exactly what we need.
   * For single-side selections the entry keeps its `side` so only that half
   * lights up.
   */
  const bodyData: ExtendedBodyPart[] = useMemo(() => {
    // Group entries by slug
    const bySlug = new Map<string, SoreArea[]>();
    for (const area of value) {
      const list = bySlug.get(area.slug) ?? [];
      list.push(area);
      bySlug.set(area.slug, list);
    }

    const result: ExtendedBodyPart[] = [];
    for (const [, areas] of bySlug) {
      const hasBilateral =
        areas.some((a) => a.side === "left") && areas.some((a) => a.side === "right");
      if (hasBilateral) {
        // Both sides selected — use the highest severity so the color is
        // representative, and omit `side` so the library fills both paths.
        const maxSeverity = Math.max(...areas.map((a) => a.severity)) as 1 | 2 | 3;
        result.push({
          slug: areas[0].slug,
          // side intentionally omitted → library highlights both left & right
          color: SEVERITY_COLORS[maxSeverity],
          intensity: maxSeverity,
        });
      } else {
        // Single side (or center/bilateral-agnostic muscle) — pass through as-is
        for (const area of areas) {
          result.push({
            slug: area.slug,
            side: area.side,
            color: SEVERITY_COLORS[area.severity],
            intensity: area.severity,
          });
        }
      }
    }
    return result;
  }, [value]);

  /* Handle click — cycle severity: none → mild → moderate → severe → none */
  const handleBodyPartPress = useCallback(
    (part: ExtendedBodyPart, side?: "left" | "right") => {
      if (disabled || !part.slug) return;

      const slug = part.slug;
      const existing = value.find((a) => a.slug === slug && a.side === side);

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
        onChange([...value, { region, slug, side, severity: 1 }]);
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

  /* A11y: enhance the library-rendered SVG paths with keyboard + screen-reader
   * semantics. The library renders clickable paths as `<path id={slug}>` in
   * document order: commonPaths → leftPaths → rightPaths per body part. We
   * walk them, tag each with role/tabIndex/aria-label/aria-pressed, and infer
   * side from the position of same-id siblings. */
  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;

    const enhance = () => {
      const paths = container.querySelectorAll<SVGPathElement>("svg path[id]");

      // First pass: count paths per slug so we can map index → side.
      const totals = new Map<string, number>();
      paths.forEach((p) => {
        const id = p.getAttribute("id");
        if (!id) return;
        totals.set(id, (totals.get(id) ?? 0) + 1);
      });

      // Second pass: assign attributes.
      const seen = new Map<string, number>();
      paths.forEach((p) => {
        const id = p.getAttribute("id");
        if (!id) return;
        const total = totals.get(id) ?? 1;
        const idx = seen.get(id) ?? 0;
        seen.set(id, idx + 1);

        let side: "left" | "right" | undefined;
        if (total === 2) side = idx === 0 ? "left" : "right";
        else if (total >= 3) side = idx === 0 ? undefined : idx === 1 ? "left" : "right";

        const slug = id as Slug;
        const label = slugToRegionLabel(slug, side);
        const pressed = value.some((a) => a.slug === slug && a.side === side);

        p.setAttribute("role", "button");
        p.setAttribute("tabindex", disabled ? "-1" : "0");
        p.setAttribute("aria-label", label);
        p.setAttribute("aria-pressed", pressed ? "true" : "false");
      });
    };

    enhance();

    // The library may re-render paths when data/side changes — observe
    // childList so we re-apply attributes whenever new paths appear (also
    // covers the initial dynamic-import mount).
    const observer = new MutationObserver(enhance);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [value, disabled, viewSide, bodyData]);

  /* A11y: handle Enter/Space on a focused path by dispatching a click, which
   * the library's onClick will turn into onBodyPartPress. */
  const handleSvgKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = e.target as Element;
      if (!(target instanceof SVGElement) || target.tagName.toLowerCase() !== "path") return;
      if (target.getAttribute("role") !== "button") return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        (target as unknown as { click: () => void }).click();
      }
    },
    [disabled]
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
        <div ref={svgContainerRef} onKeyDown={handleSvgKeyDown} className="w-[220px] sm:w-[260px]">
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
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: SEVERITY_COLORS[sev] }} />
            <span className="text-nano text-muted font-medium">{SEVERITY_LABELS[sev]}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="text-center text-nano text-surface-500">
        Tap a body part to mark soreness. Tap again to increase severity.
      </p>

      {/* Selected area tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {value.map((area) => (
            <span
              key={`${area.slug}-${area.side ?? "center"}`}
              className={cn(
                "inline-flex items-center gap-1 text-micro font-medium px-2.5 py-1 rounded-full border",
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
