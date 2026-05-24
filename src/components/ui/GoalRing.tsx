interface GoalRingProps {
  current: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function GoalRing({ current, goal, size = 96, strokeWidth = 7, label }: GoalRingProps) {
  const center = size / 2;
  const r = center - strokeWidth;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(current / goal, 1);
  const filled = pct * circ;
  const displayLabel = label ?? `${(pct * 100).toFixed(1)}%`;

  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--card-bg)] shadow-neo-raised"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="#FFC800"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text
          x={center}
          y={center - 3}
          textAnchor="middle"
          fontSize={size * 0.12}
          fontWeight={800}
          fontFamily="var(--font-ibm-plex-mono)"
          fill="var(--foreground)"
        >
          {displayLabel}
        </text>
        <text
          x={center}
          y={center + size * 0.13}
          textAnchor="middle"
          fontSize={size * 0.075}
          fontWeight={600}
          fontFamily="var(--font-dm-sans)"
          fill="var(--muted)"
          letterSpacing={1}
        >
          TO GOAL
        </text>
      </svg>
    </div>
  );
}
