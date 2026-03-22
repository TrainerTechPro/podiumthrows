import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteSettingsLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-24 h-7" />
        <SkeletonLine className="w-48 h-4" />
      </div>

      {/* Avatar + name */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse shrink-0" />
          <SkeletonLine className="w-28 h-8 rounded-lg" />
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-20 h-3" />
              <SkeletonLine className="w-full h-10 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Events */}
        <div className="space-y-2">
          <SkeletonLine className="w-16 h-3" />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLine key={i} className="w-20 h-8 rounded-full" />
            ))}
          </div>
        </div>

        <SkeletonLine className="w-28 h-10 rounded-xl" />
      </div>
    </div>
  );
}
