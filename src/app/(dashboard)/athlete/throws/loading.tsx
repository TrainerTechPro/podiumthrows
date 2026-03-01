import { SkeletonLine, SkeletonCard } from "@/components/ui/Skeleton";

export default function AthleteThrowsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-44 h-7" />
        <SkeletonLine className="w-56 h-4" />
      </div>

      {/* Action chips */}
      <div className="flex gap-2">
        <SkeletonLine className="w-20 h-8 rounded-full" />
        <SkeletonLine className="w-28 h-8 rounded-full" />
      </div>

      {/* Active session card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine className="w-2/5 h-5" />
          <SkeletonLine className="w-16 h-5 rounded-full" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine key={i} className="w-8 h-8 rounded-full" />
          ))}
        </div>
        <SkeletonLine className="w-full h-32 rounded-xl" />
      </div>

      {/* Upcoming sessions */}
      <div className="space-y-3">
        <SkeletonLine className="w-28 h-4" />
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="p-3" />
        ))}
      </div>

      {/* Recent sessions */}
      <div className="space-y-3">
        <SkeletonLine className="w-36 h-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="p-3" />
        ))}
      </div>
    </div>
  );
}
