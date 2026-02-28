import { SkeletonStat, SkeletonLine, SkeletonCard } from "@/components/ui/Skeleton";

export default function AthleteDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse shrink-0" />
        <div className="space-y-2">
          <SkeletonLine className="w-40 h-6" />
          <SkeletonLine className="w-24 h-4" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Tab content area */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4" />
        ))}
      </div>
    </div>
  );
}
