import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachPlansLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-60 h-4" />
        </div>
        <SkeletonLine className="w-32 h-9 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
