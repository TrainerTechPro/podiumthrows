import { Skeleton, SkeletonStat, SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function AthleteDashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonLine className="w-56 h-7" />
          <SkeletonLine className="w-40 h-4" />
        </div>
        <SkeletonLine className="w-24 h-9 rounded-xl" />
      </div>

      {/* Stats row: readiness + 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Readiness widget */}
        <div className="card px-5 py-4 sm:col-span-2 flex items-center gap-4">
          <Skeleton className="w-24 h-24 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-28 h-4" />
            <SkeletonLine className="w-20 h-3" />
          </div>
        </div>
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      {/* Volume widget */}
      <Skeleton className="w-full h-48 rounded-xl" />

      {/* Quick actions */}
      <div className="flex gap-2">
        <SkeletonLine className="w-28 h-10 rounded-full" />
        <SkeletonLine className="w-32 h-10 rounded-full" />
        <SkeletonLine className="w-36 h-10 rounded-full" />
      </div>

      {/* Two-column body */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3">
          <SkeletonLine className="w-36 h-4" />
          <div className="card py-1">
            <div className="space-y-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} className="border-0 shadow-none" />
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-3">
          <SkeletonLine className="w-28 h-4" />
          <div className="card py-1">
            <div className="space-y-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} className="border-0 shadow-none" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
