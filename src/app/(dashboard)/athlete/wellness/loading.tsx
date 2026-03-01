import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteWellnessLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-48 h-7" />
        <SkeletonLine className="w-56 h-4" />
      </div>

      {/* Score hero card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine className="w-32 h-5" />
          <SkeletonLine className="w-20 h-5 rounded-full" />
        </div>
        <SkeletonLine className="w-20 h-12 mx-auto" />
        <SkeletonLine className="w-28 h-4 mx-auto" />
      </div>

      {/* Factor breakdown */}
      <div className="card p-5 space-y-4">
        <SkeletonLine className="w-36 h-4" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-16 h-3" />
              <SkeletonLine className="w-full h-3 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="card p-5 space-y-3">
        <SkeletonLine className="w-28 h-4" />
        <SkeletonLine className="w-full h-40 rounded-xl" />
      </div>

      {/* Recent check-ins */}
      <div className="space-y-3">
        <SkeletonLine className="w-36 h-5" />
        <div className="card divide-y divide-[var(--card-border)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <SkeletonLine className="w-28 h-4" />
                <SkeletonLine className="w-10 h-5 rounded-full" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <SkeletonLine key={j} className="h-3" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
