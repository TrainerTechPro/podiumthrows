import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function ThrowsBuilderLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-44 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      {/* Builder form card */}
      <div className="card p-6 space-y-5">
        {/* Two-column fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-24 h-3" />
              <SkeletonLine className="w-full h-10 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Block area */}
        <div className="space-y-3">
          <SkeletonLine className="w-28 h-4" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <SkeletonLine className="w-28 h-4" />
                <SkeletonLine className="w-8 h-8 rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <SkeletonLine className="w-16 h-3" />
                    <SkeletonLine className="w-full h-9 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Save button */}
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
    </div>
  );
}
