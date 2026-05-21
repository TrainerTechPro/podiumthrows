import { SkeletonLine, Skeleton } from "@/components/ui/Skeleton";

export default function AthleteProfileLoading() {
  return (
    <div className="space-y-8">
      {/* Profile command center */}
      <div className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2 min-w-0 flex-1">
                <SkeletonLine className="w-24 h-3" />
                <SkeletonLine className="w-44 h-7" />
                <SkeletonLine className="w-36 h-4" />
              </div>
            </div>
            <Skeleton className="w-14 h-14 rounded-full" />
          </div>
          <div className="mt-5 flex gap-2">
            <SkeletonLine className="w-20 h-8 rounded-full" />
            <SkeletonLine className="w-16 h-8 rounded-full" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonLine className="w-14 h-3" />
                <SkeletonLine className="w-16 h-6" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid border-t border-[var(--card-border)] sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex min-h-[64px] items-center gap-3 px-5 py-3">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="space-y-2 flex-1">
                <SkeletonLine className="w-24 h-4" />
                <SkeletonLine className="w-36 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-4 space-y-3"
          >
            <SkeletonLine className="w-24 h-3" />
            <SkeletonLine className="w-20 h-6" />
            <SkeletonLine className="w-full h-4" />
          </div>
        ))}
      </div>

      {/* Tab bar skeleton */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-2">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-2.5 px-2 sm:flex-col sm:gap-1.5">
              <Skeleton className="w-5 h-5 rounded-md" />
              <SkeletonLine className="w-20 sm:w-8 h-3" />
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
