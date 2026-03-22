import { SkeletonLine, SkeletonStat } from "@/components/ui/Skeleton";

export default function ThrowsRosterLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-48 h-4" />
        </div>
        <SkeletonLine className="w-24 h-9 rounded-xl" />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Athlete list */}
      <div className="card divide-y divide-[var(--card-border)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-36 h-4" />
              <SkeletonLine className="w-24 h-3" />
            </div>
            <div className="hidden sm:flex gap-2">
              <SkeletonLine className="w-14 h-5 rounded-full" />
              <SkeletonLine className="w-14 h-5 rounded-full" />
            </div>
            <SkeletonLine className="w-20 h-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
