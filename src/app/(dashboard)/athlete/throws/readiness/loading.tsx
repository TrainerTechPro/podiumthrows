import { Skeleton, SkeletonLine, SkeletonStat } from "@/components/ui/Skeleton";

export default function ThrowsProfileLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-40 h-7" />
        <SkeletonLine className="w-56 h-4" />
      </div>

      {/* Event tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-8 rounded-lg" />
        ))}
      </div>

      {/* Profile card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine className="w-36 h-5" />
          <SkeletonLine className="w-24 h-8 rounded-lg" />
        </div>
        {/* Score arc placeholder */}
        <Skeleton className="w-40 h-40 rounded-full mx-auto" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="card p-5 space-y-3">
        <SkeletonLine className="w-32 h-5" />
        <Skeleton className="w-full h-48 rounded-lg" />
      </div>
    </div>
  );
}
