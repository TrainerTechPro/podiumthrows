type BondCategory = "CE" | "SDE" | "SPE" | "GPE";

const categoryColors: Record<BondCategory, string> = {
  CE: "text-danger-500 bg-danger-500/10",
  SDE: "text-warning-500 bg-warning-500/10",
  SPE: "text-info-500 bg-info-500/10",
  GPE: "text-[var(--muted)] bg-surface-500/10",
};

export function BondarchukBadge({ category }: { category: BondCategory }) {
  return (
    <span
      className={`
      inline-block px-1.5 py-0.5 rounded-full
      font-mono text-nano font-semibold uppercase tracking-wider
      shadow-neo-inset-sm
      ${categoryColors[category]}
    `}
    >
      {category}
    </span>
  );
}
