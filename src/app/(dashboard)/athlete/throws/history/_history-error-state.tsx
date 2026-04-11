import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
  onRetry: () => void;
}

export function HistoryErrorState({ message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="card text-center py-10 px-6 border border-red-500/30 bg-red-500/5"
    >
      <AlertTriangle
        size={24}
        strokeWidth={1.75}
        className="text-red-400 mx-auto mb-3"
        aria-hidden="true"
      />
      <h3 className="font-semibold text-[var(--foreground)]">Couldn&rsquo;t load history</h3>
      <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 px-5 py-2 rounded-lg bg-primary-500/15 text-primary-500 text-sm font-semibold hover:bg-primary-500/25 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
