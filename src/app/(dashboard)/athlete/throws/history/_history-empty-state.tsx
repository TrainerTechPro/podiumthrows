import Link from "next/link";
import { Target } from "lucide-react";

export function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
        <Target size={28} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
      </div>
      <h2 className="text-section font-heading text-[var(--foreground)]">No throws yet</h2>
      <p className="text-sm text-surface-700 dark:text-surface-300 mt-2 max-w-xs">
        Log your first throw to start building your history. Every rep matters.
      </p>
      <Link
        href="/athlete/throws/log"
        className="mt-6 inline-flex items-center px-6 py-3 rounded-xl bg-primary-500 text-black font-heading font-bold tracking-wide hover:bg-primary-400 transition-colors"
      >
        LOG A THROW
      </Link>
    </div>
  );
}
