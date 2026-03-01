import { SkeletonLine, SkeletonCard, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function CoachThrowsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-40 h-7" />
          <SkeletonLine className="w-56 h-4" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLine key={i} className="w-28 h-9 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Quick action grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2 flex flex-col items-center">
            <SkeletonLine className="w-10 h-10 rounded-xl" />
            <SkeletonLine className="w-20 h-3" />
          </div>
        ))}
      </div>

      {/* Roster table */}
      <div className="card !p-0">
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <SkeletonLine className="w-32 h-5" />
          <SkeletonLine className="w-24 h-4" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={5} />
        ))}
      </div>

      {/* Recent sessions */}
      <div className="space-y-3">
        <SkeletonLine className="w-36 h-5" />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="p-3" />
        ))}
      </div>
    </div>
  );
}
