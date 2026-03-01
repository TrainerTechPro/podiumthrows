import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteSessionsLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-36 h-7" />
        <SkeletonLine className="w-28 h-4" />
      </div>

      {/* Upcoming section */}
      <div className="space-y-3">
        <SkeletonLine className="w-24 h-3" />
        <div className="card divide-y divide-[var(--card-border)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="space-y-1 shrink-0">
                <SkeletonLine className="w-8 h-3" />
                <SkeletonLine className="w-8 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <SkeletonLine className="w-2/5 h-4" />
                <SkeletonLine className="w-1/3 h-3" />
              </div>
              <SkeletonLine className="w-16 h-5 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Past section */}
      <div className="space-y-3">
        <SkeletonLine className="w-28 h-3" />
        <div className="card divide-y divide-[var(--card-border)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="space-y-1 shrink-0">
                <SkeletonLine className="w-8 h-3" />
                <SkeletonLine className="w-8 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <SkeletonLine className="w-2/5 h-4" />
                <SkeletonLine className="w-1/4 h-3" />
              </div>
              <SkeletonLine className="w-20 h-5 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
