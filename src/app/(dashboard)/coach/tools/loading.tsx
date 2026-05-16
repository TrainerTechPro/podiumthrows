import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachToolsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-24 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
