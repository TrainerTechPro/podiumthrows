import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteAchievementsLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-28 h-4" />
        </div>
        <SkeletonLine className="w-20 h-8 rounded-lg" />
      </div>

      {/* Category sections */}
      {["Consistency", "Training", "Personal Bests"].map((category) => (
        <div key={category} className="space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonLine className="w-28 h-5" />
            <SkeletonLine className="w-12 h-4" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card p-4 flex flex-col items-center text-center space-y-2">
                <SkeletonLine className="w-12 h-12 rounded-full" />
                <SkeletonLine className="w-3/4 h-4" />
                <SkeletonLine className="w-full h-3" />
                <SkeletonLine className="w-1/2 h-3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
