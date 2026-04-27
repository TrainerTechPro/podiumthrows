import { cn } from "@/lib/utils";

export interface MiniSparklinePoint {
  date: string;
  value: number;
}

interface MiniSparklineProps {
  /** Chronological order: oldest → newest. */
  data: MiniSparklinePoint[];
  width?: number;
  height?: number;
  /** Tailwind text-color class — stroke + dot inherit `currentColor`. */
  className?: string;
  ariaLabel?: string;
}

export function MiniSparkline({
  data,
  width = 96,
  height = 40,
  className,
  ariaLabel,
}: MiniSparklineProps) {
  const PAD_X = 2;
  const PAD_TOP = 4;
  const PAD_BOTTOM = 3;

  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? "Not enough history for a trend"}
        className={cn("text-muted/30", className)}
      >
        <line
          x1={PAD_X}
          y1={height / 2}
          x2={width - PAD_X}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2,3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => ({
    x: PAD_X + (i / (data.length - 1)) * innerW,
    y: PAD_TOP + (1 - (d.value - min) / range) * innerH,
  }));

  const linePath = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`;

  const baseY = height - PAD_BOTTOM;
  const areaPath =
    `M ${points[0].x.toFixed(1)},${baseY.toFixed(1)} ` +
    `L ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} ` +
    `L ${points[points.length - 1].x.toFixed(1)},${baseY.toFixed(1)} Z`;

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `Trend across ${data.length} entries`}
      className={cn("overflow-visible text-primary-500", className)}
    >
      <path d={areaPath} fill="currentColor" fillOpacity="0.12" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r="2.25"
        fill="currentColor"
        stroke="var(--card-bg)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
