import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteGoalsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-28 h-7" />
          <SkeletonLine className="w-36 h-4" />
        </div>
        <SkeletonLine className="w-24 h-9 rounded-xl" />
      </div>

      {/* Active goals */}
      <div className="space-y-3">
        <SkeletonLine className="w-16 h-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <SkeletonLine className="w-2/5 h-5" />
                <SkeletonLine className="w-14 h-5 rounded-full" />
              </div>
              <SkeletonLine className="w-full h-2 rounded-full" />
              <div className="flex items-center justify-between">
                <SkeletonLine className="w-20 h-3" />
                <SkeletonLine className="w-20 h-3" />
              </div>
              <SkeletonLine className="w-3/4 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Completed goals */}
      <div className="space-y-3">
        <SkeletonLine className="w-24 h-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <SkeletonLine className="w-1/3 h-5" />
              <SkeletonLine className="w-full h-2 rounded-full" />
              <SkeletonLine className="w-1/4 h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
