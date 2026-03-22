import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function LogSessionLoading() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto space-y-6">
      {/* Wizard progress bar */}
      <Skeleton className="w-full h-1.5 rounded-full" />

      {/* Step header */}
      <div className="space-y-2">
        <SkeletonLine className="w-20 h-3" />
        <SkeletonLine className="w-44 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      {/* Event selection grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      {/* Next button */}
      <SkeletonLine className="w-full h-12 rounded-xl" />
    </div>
  );
}
