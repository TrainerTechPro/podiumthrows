import { SkeletonLine, SkeletonCard } from "@/components/ui/Skeleton";

export default function CoachGoalsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonLine className="w-32 h-7" />
          <SkeletonLine className="w-48 h-4" />
        </div>
        <SkeletonLine className="w-28 h-9 rounded-xl" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
