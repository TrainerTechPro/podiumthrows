interface ComparisonBarProps {
  label: string;
  sublabel?: string;
  value: number;
  referenceMax: number;
  unit?: string;
  isPR?: boolean;
  colorClass?: string;
}

export function ComparisonBar({
  label,
  sublabel,
  value,
  referenceMax,
  unit = "m",
  isPR,
  colorClass = "bg-primary-500",
}: ComparisonBarProps) {
  const pct = Math.min((value / referenceMax) * 100, 100);
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-14 flex-shrink-0 text-right">
        <div className="text-caption font-semibold text-[var(--foreground)]">{label}</div>
        {sublabel && <div className="text-nano text-[var(--muted)]">{sublabel}</div>}
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--background)] shadow-neo-inset-sm overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-[width] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 flex-shrink-0">
        <div
          className={`font-mono text-nano font-semibold ${isPR ? "text-primary-500" : "text-[var(--foreground)]"}`}
        >
          {value}
          {unit}
        </div>
        {isPR && <div className="text-nano text-status-success-fg font-bold">PR</div>}
      </div>
    </div>
  );
}
