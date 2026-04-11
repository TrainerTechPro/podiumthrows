import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function ThrowsHistoryLoading() {
  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-4">
      <div className="space-y-2">
        <SkeletonLine className="w-32 h-8" />
        <SkeletonLine className="w-48 h-4" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-8 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2">
            <SkeletonLine className="w-16 h-3" />
            <SkeletonLine className="w-24 h-5" />
            <Skeleton className="w-full h-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
