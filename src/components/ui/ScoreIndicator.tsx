import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { SCORE_FILL } from "@/lib/design-tokens";

export type ScoreVariant = "circle" | "pill" | "badge";

export interface ScoreIndicatorProps extends HTMLAttributes<HTMLElement> {
  /** 1–10 scale */
  score: number;
  variant?: ScoreVariant;
  /** Show numeric label */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  /** Context label (e.g. "Readiness", "RPE") */
  context?: string;
}

/* Color tiers: green 8-10, amber 5-7, red 1-4 */
function getScoreColor(score: number) {
  if (score >= 8) return {
    text:   "text-success-700 dark:text-success-400",
    bg:     "bg-success-50   dark:bg-success-500/15",
    ring:   "ring-success-500",
    fill:   SCORE_FILL.success,
    track:  "stroke-success-100 dark:stroke-success-500/20",
  };
  if (score >= 5) return {
    text:   "text-warning-700 dark:text-warning-400",
    bg:     "bg-warning-50   dark:bg-warning-500/15",
    ring:   "ring-warning-500",
    fill:   SCORE_FILL.warning,
    track:  "stroke-warning-100 dark:stroke-warning-500/20",
  };
  return {
    text:   "text-danger-700  dark:text-danger-400",
    bg:     "bg-danger-50     dark:bg-danger-500/15",
    ring:   "ring-danger-500",
    fill:   SCORE_FILL.danger,
    track:  "stroke-danger-100 dark:stroke-danger-500/20",
  };
}

function getScoreLabel(score: number) {
  if (score >= 9) return "Excellent";
  if (score >= 8) return "Great";
  if (score >= 7) return "Good";
  if (score >= 6) return "Fair";
  if (score >= 5) return "Moderate";
  if (score >= 4) return "Low";
  if (score >= 3) return "Poor";
  return "Critical";
}

/* ─── Circle Variant ─────────────────────────────────────────────────────── */

const circleSize = {
  sm: { wh: 48, radius: 19, strokeW: 3, text: "text-sm font-bold" },
  md: { wh: 72, radius: 28, strokeW: 4, text: "text-xl font-bold" },
  lg: { wh: 96, radius: 38, strokeW: 5, text: "text-2xl font-bold" },
};

function CircleScore({ score, size = "md", context }: Pick<ScoreIndicatorProps, "score" | "size" | "context">) {
  const { wh, radius, strokeW, text } = circleSize[size ?? "md"];
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const dashOffset = circumference * (1 - pct);
  const colors = getScoreColor(score);
  const center = wh / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center" style={{ width: wh, height: wh }}>
        <svg
          width={wh}
          height={wh}
          viewBox={`0 0 ${wh} ${wh}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeW}
            className={colors.track}
            stroke="currentColor"
          />
          {/* Fill */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeW}
            stroke={colors.fill}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <span className={cn("absolute tabular-nums leading-none", text, colors.text)}>
          {score.toFixed(score % 1 === 0 ? 0 : 1)}
        </span>
      </div>
      {context && <p className="text-xs text-muted text-center">{context}</p>}
    </div>
  );
}

/* ─── Pill Variant ───────────────────────────────────────────────────────── */

const pillSize = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-3 py-1 gap-1.5",
  lg: "text-base px-4 py-1.5 gap-2",
};

function PillScore({ score, size = "md", showLabel = false }: Pick<ScoreIndicatorProps, "score" | "size" | "showLabel">) {
  const colors = getScoreColor(score);
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-semibold tabular-nums",
      pillSize[size ?? "md"],
      colors.text,
      colors.bg
    )}>
      <span>{score.toFixed(score % 1 === 0 ? 0 : 1)}</span>
      {showLabel && <span className="font-normal opacity-80">/ 10</span>}
    </span>
  );
}

/* ─── Badge Variant (number + label stacked) ─────────────────────────────── */

function BadgeScore({ score, context }: Pick<ScoreIndicatorProps, "score" | "context">) {
  const colors = getScoreColor(score);
  return (
    <div className={cn("inline-flex flex-col items-center rounded-xl px-4 py-2.5 ring-1", colors.bg, colors.ring)}>
      <span className={cn("text-2xl font-bold font-heading tabular-nums leading-none", colors.text)}>
        {score.toFixed(score % 1 === 0 ? 0 : 1)}
      </span>
      <span className={cn("text-xs font-medium mt-0.5", colors.text)}>
        {context ?? getScoreLabel(score)}
      </span>
    </div>
  );
}

/* ─── Main Export ────────────────────────────────────────────────────────── */

export function ScoreIndicator({
  score,
  variant = "pill",
  showLabel = false,
  size = "md",
  context,
  className,
  ...props
}: ScoreIndicatorProps) {
  const clamped = Math.max(1, Math.min(10, score));

  const inner =
    variant === "circle" ? (
      <CircleScore score={clamped} size={size} context={context} />
    ) : variant === "badge" ? (
      <BadgeScore score={clamped} context={context} />
    ) : (
      <PillScore score={clamped} size={size} showLabel={showLabel} />
    );

  return (
    <span className={className} role="img" aria-label={`Score: ${clamped} out of 10`} {...props as HTMLAttributes<HTMLSpanElement>}>
      {inner}
    </span>
  );
}
