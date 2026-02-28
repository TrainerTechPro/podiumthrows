import { SkeletonLine, SkeletonCard } from "@/components/ui/Skeleton";

export default function VideosLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-48 h-4" />
        </div>
        <SkeletonLine className="w-28 h-9 rounded-lg" />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={i} className="w-16 h-7 rounded-md" />
        ))}
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <SkeletonCard className="aspect-video rounded-none" />
            <div className="p-3 space-y-2">
              <SkeletonLine className="w-3/4 h-4" />
              <SkeletonLine className="w-1/2 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
