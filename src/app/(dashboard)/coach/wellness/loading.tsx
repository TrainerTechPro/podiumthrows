import { Skeleton, SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachWellnessLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-40 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      {/* Team readiness summary */}
      <div className="card p-5 space-y-3">
        <SkeletonLine className="w-32 h-4" />
        <Skeleton className="w-24 h-10" />
        <Skeleton className="w-full h-2 rounded-full" />
      </div>

      {/* Athlete grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
