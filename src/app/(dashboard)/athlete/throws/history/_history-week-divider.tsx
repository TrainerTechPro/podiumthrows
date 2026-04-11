interface Props {
  label: string; // e.g. "Week of Mar 31"
}

export function HistoryWeekDivider({ label }: Props) {
  return (
    <div
      className="flex items-center gap-3 py-3 text-xs text-muted uppercase tracking-wider"
      role="separator"
      aria-label={label}
    >
      <span className="flex-1 h-px bg-[var(--card-border)]" />
      <span>{label}</span>
      <span className="flex-1 h-px bg-[var(--card-border)]" />
    </div>
  );
}
