import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  onClear: () => void;
}

export function HistoryFiltersEmptyState({ onClear }: Props) {
  return (
    <EmptyState
      icon={<Search size={48} strokeWidth={1.5} aria-hidden="true" />}
      title="No throws match these filters"
      description="Try a wider date range or a different event."
      action={
        <button
          type="button"
          onClick={onClear}
          className="px-5 py-2 rounded-lg bg-primary-500/15 text-primary-500 text-sm font-semibold hover:bg-primary-500/25 transition-colors"
        >
          Clear filters
        </button>
      }
    />
  );
}
