import { SkeletonStat, SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <SkeletonLine className="w-48 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Athlete readiness list */}
        <div className="card p-5 space-y-4">
          <SkeletonLine className="w-40 h-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} className="p-3" />
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        <div className="card p-5 space-y-4">
          <SkeletonLine className="w-36 h-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} className="p-3" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
