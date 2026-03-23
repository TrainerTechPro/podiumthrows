import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteDashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header — greeting + customize button */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonLine className="w-56 h-7" />
          <SkeletonLine className="w-40 h-4" />
        </div>
        <SkeletonLine className="w-24 h-5 rounded-md" />
      </div>

      {/* Widget skeletons stacked vertically (matches real layout) */}
      <div className="space-y-5">
        {/* Readiness Hero skeleton */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-4 h-4 rounded" />
            <SkeletonLine className="w-20 h-3" />
          </div>
          <div className="flex items-center gap-5">
            <Skeleton className="w-[120px] h-[120px] rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-40 h-5" />
              <SkeletonLine className="w-24 h-3" />
            </div>
          </div>
          {/* Factor bars 2x2 */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <SkeletonLine className="w-14 h-3" />
                  <SkeletonLine className="w-8 h-3" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats skeleton — 3 columns */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card px-4 py-3.5 flex flex-col items-center gap-1.5">
              <Skeleton className="h-7 w-10 rounded-md" />
              <SkeletonLine className="w-16 h-3" />
            </div>
          ))}
        </div>

        {/* Today Workout skeleton */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonLine className="w-32 h-3" />
            <SkeletonLine className="w-16 h-3" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <SkeletonLine className="w-48 h-5" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          {/* Timeline items */}
          <div className="space-y-3 pl-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1">
                  <SkeletonLine className="w-3/4 h-4" />
                  <SkeletonLine className="w-1/2 h-3" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Calendar skeleton */}
        <div className="card px-4 py-4 sm:px-5">
          <SkeletonLine className="w-32 h-3 mb-3" />
          <SkeletonLine className="w-28 h-4 mx-auto mb-3" />
          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`h-${i}`} className="flex justify-center">
                <SkeletonLine className="w-3 h-3" />
              </div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center justify-center h-10">
                <Skeleton className="w-6 h-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Personal Bests skeleton */}
        <div className="card py-1">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <SkeletonLine className="w-28 h-3" />
            <SkeletonLine className="w-14 h-3" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <SkeletonLine className="w-24 h-4" />
                <SkeletonLine className="w-14 h-3" />
              </div>
              <SkeletonLine className="w-16 h-4" />
            </div>
          ))}
        </div>

        {/* Volume skeleton */}
        <div className="card px-6 py-5 space-y-4">
          <SkeletonLine className="w-32 h-3" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="sm:col-span-2 space-y-2">
              <SkeletonLine className="w-24 h-3" />
              <div className="flex items-end gap-1.5 h-20">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="flex-1 rounded-t-md"
                    style={{ height: `${20 + ((i * 13 + 7) % 60)}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <SkeletonLine className="w-20 h-3" />
                <SkeletonLine className="w-12 h-6" />
              </div>
              <div className="space-y-1">
                <SkeletonLine className="w-20 h-3" />
                <SkeletonLine className="w-12 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
