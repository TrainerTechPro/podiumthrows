import { AlertTriangle } from "lucide-react";
import type { MovementCapability } from "@/lib/bondarchuk/movement-restrictions";

const CAPABILITY_LABELS: Record<MovementCapability, string> = {
  fullOverhead: "full overhead mobility",
  fullHipRotation: "full hip rotation",
  deepSquat: "deep squat capacity",
  singleLegStability: "single-leg stability",
};

interface Props {
  violations: MovementCapability[];
  /** "icon" — small triangle only (default, dense lists). "chip" — pill with text (less dense). */
  variant?: "icon" | "chip";
}

/**
 * Surfaces movement-restriction conflicts on an exercise — when an
 * exercise's required capabilities intersect with an athlete's
 * MovementRestrictionsData flags marked `false` (restricted).
 *
 * Renders nothing when violations is empty, so callers can pass through
 * unconditionally. Uses native `title` for hover detail since the project
 * has no tooltip primitive.
 */
export function MovementRestrictionBadge({ violations, variant = "icon" }: Props) {
  if (violations.length === 0) return null;

  const labels = violations.map((c) => CAPABILITY_LABELS[c]);
  const sentence =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  const title = `Athlete cannot perform: ${sentence}. Coach should swap or modify.`;
  const ariaLabel = `Movement restriction conflict: ${sentence}`;

  if (variant === "chip") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-warning-500/40 bg-warning-500/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-warning-500"
        title={title}
        aria-label={ariaLabel}
      >
        <AlertTriangle size={10} strokeWidth={2.25} aria-hidden="true" />
        {violations.length === 1 ? CAPABILITY_LABELS[violations[0]].split(" ")[0] : "restricted"}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center text-warning-500"
      title={title}
      aria-label={ariaLabel}
    >
      <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
