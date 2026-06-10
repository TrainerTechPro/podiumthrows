"use client";

import type { AlignmentZone } from "./wizard-machine";

/**
 * Ghost ellipse template for the throwing circle (F1): the user physically
 * moves the tripod until the real ring sits inside it. No CV in v1 — the
 * template IS the calibration ellipse once locked.
 */

const ZONE_CLASS: Record<AlignmentZone, string> = {
  MISALIGNED: "stroke-status-danger-fg",
  CLOSE: "stroke-status-warning-fg",
  LOCKED: "stroke-status-success-fg",
};

export function GhostEllipse({
  zone,
  ellipseNorm,
}: {
  zone: AlignmentZone;
  /** Normalized to the preview viewBox (0–100 both axes). */
  ellipseNorm: { cx: number; cy: number; rx: number; ry: number };
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <ellipse
        cx={ellipseNorm.cx}
        cy={ellipseNorm.cy}
        rx={ellipseNorm.rx}
        ry={ellipseNorm.ry}
        fill="none"
        strokeWidth={0.8}
        strokeDasharray={zone === "LOCKED" ? "none" : "3 2"}
        className={`${ZONE_CLASS[zone]} transition-colors duration-300`}
      />
      <line
        x1={ellipseNorm.cx - 2}
        x2={ellipseNorm.cx + 2}
        y1={ellipseNorm.cy}
        y2={ellipseNorm.cy}
        strokeWidth={0.5}
        className={ZONE_CLASS[zone]}
      />
      <line
        x1={ellipseNorm.cx}
        x2={ellipseNorm.cx}
        y1={ellipseNorm.cy - 2}
        y2={ellipseNorm.cy + 2}
        strokeWidth={0.5}
        className={ZONE_CLASS[zone]}
      />
    </svg>
  );
}
