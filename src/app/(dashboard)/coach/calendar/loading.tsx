import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="border-b border-[var(--card-border)] flex gap-2 pb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="overflow-x-auto custom-scrollbar -mx-1 px-1 pt-3">
        <div className="grid grid-cols-7 gap-2 min-w-[980px] md:min-w-0">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-[var(--card-border)] min-h-[160px]"
            >
              <div className="px-2.5 py-2 border-b border-[var(--card-border)]">
                <Skeleton className="h-3.5 w-12" />
              </div>
              <div className="flex-1 p-1.5 space-y-1.5">
                {i % 3 !== 2 && <Skeleton className="h-16 rounded-xl" />}
                {i % 2 === 0 && <Skeleton className="h-16 rounded-xl" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
