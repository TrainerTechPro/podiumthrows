import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function ProgrammingLoading() {
  return (
    <div className="space-y-6">
      {/* Header + nav */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-40 h-7" />
          <SkeletonLine className="w-56 h-4" />
        </div>
        <SkeletonLine className="w-28 h-9 rounded-xl" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--muted-bg)] w-fit">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonLine key={i} className="w-24 h-8 rounded-lg" />
        ))}
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <SkeletonLine className="w-8 h-8 rounded-lg" />
        <SkeletonLine className="w-40 h-5" />
        <SkeletonLine className="w-8 h-8 rounded-lg" />
      </div>

      {/* Week calendar grid — 7 columns */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine className="w-full h-5 rounded-md" />
            <Skeleton className="w-full h-32 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
