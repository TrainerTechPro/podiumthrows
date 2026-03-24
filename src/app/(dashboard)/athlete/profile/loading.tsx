import { SkeletonLine, Skeleton } from "@/components/ui/Skeleton";

export default function AthleteProfileLoading() {
  return (
    <div className="space-y-6">
      {/* Tab bar skeleton */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-2">
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 py-2.5">
              <Skeleton className="w-5 h-5 rounded-md" />
              <SkeletonLine className="w-8 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Content skeleton — mimics a form section */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-6 space-y-6">
        {/* Section header */}
        <div className="space-y-2">
          <SkeletonLine className="w-32 h-6" />
          <SkeletonLine className="w-56 h-4" />
        </div>

        {/* Form fields row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-20 h-3" />
              <Skeleton className="w-full h-10 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Another row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="w-16 h-3" />
              <Skeleton className="w-full h-10 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Textarea-like block */}
        <div className="space-y-2">
          <SkeletonLine className="w-24 h-3" />
          <Skeleton className="w-full h-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
