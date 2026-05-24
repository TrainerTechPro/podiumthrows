type BondCategory = "CE" | "SDE" | "SPE" | "GPE";

interface CompositionSegment {
  category: BondCategory;
  pct: number;
}

interface TrainingCompositionBarProps {
  name: string;
  segments: CompositionSegment[];
  tag?: string;
}

const SEGMENT_COLORS: Record<BondCategory, string> = {
  CE: "#E05252",
  SDE: "#E08C52",
  SPE: "#52A0E0",
  GPE: "#6B7280",
};

export function TrainingCompositionBar({ name, segments, tag }: TrainingCompositionBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 flex-shrink-0 text-caption font-heading font-bold text-[var(--foreground)] truncate">
        {name}
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--background)] shadow-neo-inset-sm overflow-hidden flex">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full transition-[width] duration-500"
            style={{ width: `${seg.pct}%`, background: SEGMENT_COLORS[seg.category] }}
          />
        ))}
      </div>
      {tag && (
        <span className="w-8 flex-shrink-0 text-right font-mono text-nano text-[var(--muted)]">
          {tag}
        </span>
      )}
    </div>
  );
}

export function TrainingCompositionLegend() {
  return (
    <div className="flex gap-3 mb-3">
      {(Object.entries(SEGMENT_COLORS) as [BondCategory, string][]).map(([cat, col]) => (
        <div key={cat} className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: col }} />
          <span className="text-nano text-[var(--muted)] font-semibold">{cat}</span>
        </div>
      ))}
    </div>
  );
}
