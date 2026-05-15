import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachIntegrationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-44 h-7" />
        <SkeletonLine className="w-72 h-4" />
      </div>

      {/* A short stack of integration cards (WHOOP, etc.) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
