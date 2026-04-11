import { Filter } from "lucide-react";

interface Props {
  onClear: () => void;
}

export function HistoryFiltersEmptyState({ onClear }: Props) {
  return (
    <div className="card text-center py-10 px-6">
      <Filter size={24} strokeWidth={1.75} className="text-muted mx-auto mb-3" aria-hidden="true" />
      <h3 className="font-semibold text-[var(--foreground)]">No throws match these filters</h3>
      <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
        Try a wider date range or different events
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 px-5 py-2 rounded-lg bg-primary-500/15 text-primary-500 text-sm font-semibold hover:bg-primary-500/25 transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}
