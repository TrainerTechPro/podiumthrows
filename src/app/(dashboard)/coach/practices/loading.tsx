import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachPracticesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-32 h-7" />
          <SkeletonLine className="w-56 h-4" />
        </div>
        <SkeletonLine className="w-32 h-9 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
