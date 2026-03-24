export default function SelfProgramLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-200 dark:bg-surface-800 rounded-lg" />
          <div className="h-4 w-32 bg-surface-200 dark:bg-surface-800 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-surface-200 dark:bg-surface-800 rounded-xl" />
          <div className="h-9 w-24 bg-surface-200 dark:bg-surface-800 rounded-xl" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-3 w-20 bg-surface-200 dark:bg-surface-800 rounded" />
            <div className="h-8 w-16 bg-surface-200 dark:bg-surface-800 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Phase timeline */}
      <div className="card p-5 space-y-4">
        <div className="h-3 w-28 bg-surface-200 dark:bg-surface-800 rounded" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-16 bg-surface-200 dark:bg-surface-800 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Session cards */}
      <div className="space-y-3">
        <div className="h-3 w-16 bg-surface-200 dark:bg-surface-800 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-surface-200 dark:bg-surface-800 rounded" />
              <div className="h-3 w-48 bg-surface-200 dark:bg-surface-800 rounded" />
            </div>
            <div className="h-6 w-12 bg-surface-200 dark:bg-surface-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
