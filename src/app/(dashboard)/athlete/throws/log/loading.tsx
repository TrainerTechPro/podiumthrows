import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function ThrowsLogLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-36 h-7" />
        <SkeletonLine className="w-52 h-4" />
      </div>

      {/* Event + filter bar */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-8 rounded-full" />
        ))}
      </div>

      {/* Form card */}
      <div className="card p-5 space-y-4">
        <SkeletonLine className="w-28 h-5" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-20 h-3" />
              <SkeletonLine className="w-full h-10 rounded-lg" />
            </div>
          ))}
        </div>
        <SkeletonLine className="w-full h-12 rounded-xl" />
      </div>

      {/* Chart */}
      <div className="card p-5 space-y-3">
        <SkeletonLine className="w-32 h-5" />
        <Skeleton className="w-full h-40 rounded-lg" />
      </div>
    </div>
  );
}
