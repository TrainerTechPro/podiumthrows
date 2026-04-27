import { Skeleton, SkeletonLine, SkeletonStat } from "@/components/ui/Skeleton";

/**
 * Generic coach-page fallback. Resolves for any coach route that doesn't
 * provide its own loading.tsx. Coach surfaces are desk-register: header bar,
 * stat row (when present), then a primary content panel.
 */
export default function CoachSegmentLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header — title + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonLine className="w-56 h-7" />
          <SkeletonLine className="w-72 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Stat strip (typical for index pages) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Primary content panel */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine className="w-40 h-4" />
          <SkeletonLine className="w-16 h-3" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 border-b border-[var(--card-border)] last:border-b-0"
            >
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <SkeletonLine className="w-1/3 h-4" />
                <SkeletonLine className="w-1/2 h-3" />
              </div>
              <SkeletonLine className="w-16 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
