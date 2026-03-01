import { SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachInvitationsLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-48 h-4" />
        </div>
        <SkeletonLine className="w-32 h-9 rounded-xl" />
      </div>

      {/* Pending section */}
      <div className="space-y-3">
        <SkeletonLine className="w-20 h-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonLine className="w-48 h-4" />
              <SkeletonLine className="w-32 h-3" />
            </div>
            <div className="flex gap-2">
              <SkeletonLine className="w-20 h-8 rounded-lg" />
              <SkeletonLine className="w-16 h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Past section */}
      <div className="space-y-3">
        <SkeletonLine className="w-12 h-4" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonLine className="w-44 h-4" />
              <SkeletonLine className="w-28 h-3" />
            </div>
            <SkeletonLine className="w-20 h-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
