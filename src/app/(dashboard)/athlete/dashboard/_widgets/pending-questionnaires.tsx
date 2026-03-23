import Link from "next/link";
import { ClipboardList, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components";
import type { QuestionnairesData } from "@/lib/data/dashboard";

export function PendingQuestionnairesWidget({
  data,
}: {
  data: QuestionnairesData;
}) {
  return (
    <div className="card px-4 py-4 sm:px-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Questionnaires
          </h3>
          {data.pendingCount > 0 && (
            <Badge variant="warning">{data.pendingCount}</Badge>
          )}
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 gap-3">
          <div className="w-11 h-11 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
            <CheckCircle2
              size={20}
              strokeWidth={1.75}
              className="text-success-500"
              aria-hidden="true"
            />
          </div>
          <div className="max-w-[240px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              All caught up
            </p>
            <p className="text-xs text-muted mt-1">
              No pending questionnaires — you&apos;re all set!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {data.items.map((q) => (
            <Link
              key={q.id}
              href={`/athlete/questionnaires/${q.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center shrink-0">
                <ClipboardList
                  size={14}
                  strokeWidth={1.75}
                  className="text-warning-600 dark:text-warning-400"
                  aria-hidden="true"
                />
              </div>
              <p className="flex-1 text-sm font-medium text-[var(--foreground)] truncate">
                {q.title}
              </p>
              <ChevronRight
                size={14}
                strokeWidth={1.75}
                className="text-muted group-hover:text-primary-500 transition-colors shrink-0"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
