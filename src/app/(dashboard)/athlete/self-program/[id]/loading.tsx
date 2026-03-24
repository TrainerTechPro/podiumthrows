export default function ProgramDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-36 bg-surface-200 dark:bg-surface-800 rounded" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-surface-200 dark:bg-surface-800 rounded-lg" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-surface-200 dark:bg-surface-800 rounded-full" />
            <div className="h-5 w-24 bg-surface-200 dark:bg-surface-800 rounded-full" />
          </div>
        </div>
        <div className="h-9 w-28 bg-surface-200 dark:bg-surface-800 rounded-xl" />
      </div>

      {/* Overview cards */}
      <div className="space-y-3">
        <div className="h-3 w-28 bg-surface-200 dark:bg-surface-800 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="h-2.5 w-12 bg-surface-200 dark:bg-surface-800 rounded" />
              <div className="h-5 w-16 bg-surface-200 dark:bg-surface-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Volume stats */}
      <div className="space-y-3">
        <div className="h-3 w-24 bg-surface-200 dark:bg-surface-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="h-3 w-20 bg-surface-200 dark:bg-surface-800 rounded" />
              <div className="h-8 w-16 bg-surface-200 dark:bg-surface-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs placeholder */}
      <div className="space-y-4">
        <div className="flex gap-6 border-b border-[var(--card-border)]">
          <div className="h-4 w-16 bg-surface-200 dark:bg-surface-800 rounded pb-3" />
          <div className="h-4 w-16 bg-surface-200 dark:bg-surface-800 rounded pb-3" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 h-16 bg-surface-200/30 dark:bg-surface-800/30 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
