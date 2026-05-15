import { Skeleton, SkeletonCircle, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachSidelineLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-32 h-7" />
        <SkeletonLine className="w-72 h-4" />
      </div>

      {/* List rows (athlete-by-athlete glance) */}
      <div className="card divide-y divide-[var(--card-border)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-3">
            <SkeletonCircle size="md" />
            <div className="flex-1 space-y-1.5">
              <SkeletonLine className="w-2/5 h-4" />
              <SkeletonLine className="w-1/3 h-3" />
            </div>
            <Skeleton className="w-16 h-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
