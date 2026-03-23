import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components";
import type { UpcomingSessionItem } from "@/lib/data/dashboard";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatScheduledDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ─── Widget ───────────────────────────────────────────────────────────── */

export function UpcomingSessionsWidget({
  sessions,
}: {
  sessions: UpcomingSessionItem[];
}) {
  return (
    <div className="card py-1 shadow-sm md:hover:shadow-md md:transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Upcoming Sessions
        </h3>
        <Link
          href="/athlete/sessions"
          className="text-xs text-primary-500 hover:underline"
        >
          View all &gt;
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <Calendar
              size={20}
              strokeWidth={1.75}
              className="text-surface-400 dark:text-surface-500"
              aria-hidden="true"
            />
          </div>
          <div className="max-w-[220px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              No upcoming sessions
            </p>
            <p className="text-xs text-muted mt-1">
              Your coach hasn&apos;t scheduled any sessions yet. Check back
              soon!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          {sessions.map((session) => {
            const isToday =
              formatScheduledDate(session.scheduledDate) === "Today";
            return (
              <Link
                key={session.id}
                href={`/athlete/sessions/${session.id}`}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold",
                    isToday
                      ? "bg-primary-500 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-muted"
                  )}
                >
                  {new Date(session.scheduledDate).getDate()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {session.planName ?? "Training Session"}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {formatScheduledDate(session.scheduledDate)}
                    {session.coachNotes && ` · ${session.coachNotes}`}
                  </p>
                </div>
                {session.status === "IN_PROGRESS" && (
                  <Badge variant="warning">In Progress</Badge>
                )}
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  className="text-muted group-hover:text-primary-500 transition-colors shrink-0"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
