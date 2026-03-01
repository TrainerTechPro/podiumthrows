import { SkeletonLine, SkeletonCircle } from "@/components/ui/Skeleton";

export default function CoachNotificationsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-32 h-4" />
        </div>
        <SkeletonLine className="w-28 h-8 rounded-lg" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="w-24 h-8 rounded-full" />
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-start gap-3">
            <SkeletonCircle size="md" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-3/5 h-4" />
              <SkeletonLine className="w-4/5 h-3" />
              <SkeletonLine className="w-24 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
