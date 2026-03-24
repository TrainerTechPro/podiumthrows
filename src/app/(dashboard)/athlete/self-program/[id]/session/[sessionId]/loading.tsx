export default function SessionDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto pb-24 animate-pulse">
      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-surface-200 dark:bg-surface-800 rounded" />
          <div className="flex gap-1">
            <div className="h-8 w-8 bg-surface-200 dark:bg-surface-800 rounded-lg" />
            <div className="h-8 w-8 bg-surface-200 dark:bg-surface-800 rounded-lg" />
          </div>
        </div>
        <div className="h-6 w-56 bg-surface-200 dark:bg-surface-800 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-surface-200 dark:bg-surface-800 rounded-full" />
          <div className="h-5 w-24 bg-surface-200 dark:bg-surface-800 rounded-full" />
          <div className="h-5 w-16 bg-surface-200 dark:bg-surface-800 rounded-full" />
        </div>
      </div>

      {/* Start button placeholder */}
      <div className="h-12 w-full bg-surface-200 dark:bg-surface-800 rounded-xl mb-6" />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-3 text-center space-y-2">
            <div className="h-4 w-4 bg-surface-200 dark:bg-surface-800 rounded mx-auto" />
            <div className="h-6 w-10 bg-surface-200 dark:bg-surface-800 rounded mx-auto" />
            <div className="h-3 w-12 bg-surface-200 dark:bg-surface-800 rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Throws section */}
      <div className="mb-6 space-y-3">
        <div className="h-3 w-16 bg-surface-200 dark:bg-surface-800 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-surface-200 dark:bg-surface-800 rounded" />
              <div className="h-4 w-16 bg-surface-200 dark:bg-surface-800 rounded" />
            </div>
            <div className="h-3 w-32 bg-surface-200 dark:bg-surface-800 rounded" />
          </div>
        ))}
      </div>

      {/* Strength section */}
      <div className="mb-6 space-y-3">
        <div className="h-3 w-20 bg-surface-200 dark:bg-surface-800 rounded" />
        <div className="card divide-y divide-[var(--card-border)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 flex justify-between">
              <div className="h-4 w-28 bg-surface-200 dark:bg-surface-800 rounded" />
              <div className="h-4 w-20 bg-surface-200 dark:bg-surface-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
