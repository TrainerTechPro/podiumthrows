import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

/**
 * Generic athlete-page fallback. Resolves for any athlete route that doesn't
 * provide its own loading.tsx. Bias the silhouette toward what most pages
 * render: header (title + subtitle), then a stack of cards.
 */
export default function AthleteSegmentLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-48 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      {/* 3 generic content cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonLine className="w-32 h-4" />
              <SkeletonLine className="w-16 h-3" />
            </div>
            <div className="space-y-2">
              <SkeletonLine className="w-full h-3" />
              <SkeletonLine className="w-5/6 h-3" />
              <SkeletonLine className="w-3/4 h-3" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
