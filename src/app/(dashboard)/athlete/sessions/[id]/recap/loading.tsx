export default function RecapLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-32 shimmer rounded" />
            <div className="h-8 w-64 shimmer rounded" />
            <div className="h-3 w-40 shimmer rounded" />
          </div>
          <div className="h-10 w-10 shimmer rounded-full" />
        </div>

        {/* Hero stats */}
        <div className="card p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-12 shimmer rounded" />
                <div className="h-7 w-20 shimmer rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div className="card p-5 space-y-3">
          <div className="h-3 w-24 shimmer rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-3 w-12 shimmer rounded" />
              <div className="h-6 w-16 shimmer rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 shimmer rounded" />
              <div className="h-6 w-20 shimmer rounded" />
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 shimmer rounded" />
            <div className="h-6 w-16 shimmer rounded" />
          </div>
        </div>

        {/* Top throw */}
        <div className="card p-5 space-y-3">
          <div className="h-3 w-24 shimmer rounded" />
          <div className="h-10 w-40 shimmer rounded" />
          <div className="h-3 w-32 shimmer rounded" />
          <div className="h-9 w-24 shimmer rounded-lg" />
        </div>

        {/* Wellness */}
        <div className="card p-5 space-y-4">
          <div className="h-3 w-32 shimmer rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-14 shimmer rounded" />
              <div className="flex-1 grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-10 shimmer rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <div className="h-11 w-full shimmer rounded-lg" />
          <div className="h-11 w-full shimmer rounded-lg" />
        </div>
      </div>
    </div>
  );
}
