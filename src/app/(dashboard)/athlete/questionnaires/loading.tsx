import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteQuestionnairesLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-28 h-7" />
      </div>

      {/* Due Today section */}
      <div className="space-y-3">
        <SkeletonLine className="w-24 h-4" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-2/5 h-5" />
              <div className="flex gap-2">
                <SkeletonLine className="w-14 h-5 rounded-full" />
                <SkeletonLine className="w-16 h-5 rounded-full" />
              </div>
              <SkeletonLine className="w-1/3 h-3" />
            </div>
            <SkeletonLine className="w-20 h-8 rounded-xl shrink-0" />
          </div>
        ))}
      </div>

      {/* Pending section */}
      <div className="space-y-3">
        <SkeletonLine className="w-20 h-4" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-1/3 h-5" />
              <SkeletonLine className="w-1/4 h-3" />
            </div>
            <SkeletonLine className="w-20 h-8 rounded-xl shrink-0" />
          </div>
        ))}
      </div>

      {/* Completed section */}
      <div className="space-y-3">
        <SkeletonLine className="w-24 h-4" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4 opacity-70">
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-2/5 h-4" />
              <SkeletonLine className="w-1/4 h-3" />
            </div>
            <SkeletonLine className="w-20 h-5 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
