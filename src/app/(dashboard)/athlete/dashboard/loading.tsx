import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

/* Mirrors the actual AthleteHomeClient layout (greeting + readiness ring,
   today/rest hero card with thumb-zone CTA, week strip, recent moments).
   Keep this in lock-step with _athlete-home-client.tsx so the page never
   jumps when the DTO resolves. */

export default function AthleteDashboardLoading() {
  return (
    <div className="-mx-4 -my-5 sm:-mx-6">
      {/* Hero — greeting + readiness ring */}
      <section className="px-6 pb-2 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonLine className="w-2/3 max-w-[260px] h-7 rounded-md" />
          </div>
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        </div>
        <SkeletonLine className="mt-3 w-3/4 max-w-[280px] h-4 rounded" />
      </section>

      {/* Today hero card — primary CTA in the bottom of the card stays in
          the lower thumb half of the iPhone SE viewport. */}
      <section className="mx-4 mt-2 overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between">
            <SkeletonLine className="w-24 h-3 rounded" />
            <SkeletonLine className="w-12 h-3 rounded" />
          </div>
          <SkeletonLine className="mt-3 w-3/4 max-w-[280px] h-6 rounded-md" />
          <SkeletonLine className="mt-2 w-1/2 max-w-[200px] h-3 rounded" />
        </div>
        <div className="grid grid-cols-4 gap-1.5 px-5 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--card-border)] bg-surface-50 dark:bg-surface-900/60 px-2.5 py-2 space-y-1"
            >
              <SkeletonLine className="w-8 h-2 rounded" />
              <SkeletonLine className="w-10 h-3 rounded" />
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 pt-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </section>

      {/* This week — section header */}
      <div className="mt-7 flex items-center justify-between px-5 pb-3">
        <SkeletonLine className="w-20 h-3 rounded" />
        <SkeletonLine className="w-14 h-3 rounded" />
      </div>

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1.5 px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[1/1.35] rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-1.5 pb-2 pt-2.5 flex flex-col items-center justify-between"
          >
            <SkeletonLine className="w-5 h-2 rounded" />
            <SkeletonLine className="w-4 h-4 rounded" />
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
          </div>
        ))}
      </div>

      {/* Recent — section header */}
      <div className="mt-7 flex items-center justify-between px-5 pb-3">
        <SkeletonLine className="w-16 h-3 rounded" />
        <SkeletonLine className="w-16 h-3 rounded" />
      </div>

      {/* Recent moments — 2 rows */}
      <div className="space-y-2.5 px-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <SkeletonLine className="w-24 h-3 rounded" />
              <SkeletonLine className="w-3/4 h-4 rounded" />
              <SkeletonLine className="w-1/3 h-2 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="h-12" />
    </div>
  );
}
