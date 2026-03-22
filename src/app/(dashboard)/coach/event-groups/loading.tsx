import { SkeletonLine } from "@/components/ui/Skeleton";

export default function EventGroupsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-52 h-4" />
        </div>
        <SkeletonLine className="w-28 h-9 rounded-xl" />
      </div>

      {/* Group cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <SkeletonLine className="w-32 h-5" />
                <SkeletonLine className="w-20 h-3" />
              </div>
              <div className="flex gap-1">
                <SkeletonLine className="w-7 h-7 rounded-lg" />
                <SkeletonLine className="w-7 h-7 rounded-lg" />
              </div>
            </div>
            {/* Member avatars */}
            <div className="flex -space-x-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse border-2 border-[var(--card-bg)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
