import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EVENTS, parseEvents } from "@/lib/throws/constants";
import type { Prisma } from "@prisma/client";

type AssignmentWithRelations = Prisma.ThrowsAssignmentGetPayload<{
  include: {
    session: { include: { blocks: true } };
    throwLogs: true;
    athlete: { include: { user: { select: { id: true; email: true } } } };
  };
}>;

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  NOTIFIED: "Notified",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  SKIPPED: "Skipped",
};

const BLOCK_TYPE_LABEL: Record<string, string> = {
  WARMUP: "Warm-up",
  THROWING: "Throwing",
  STRENGTH: "Strength",
  PLYOMETRIC: "Plyometric",
  COOLDOWN: "Cool-down",
  NOTES: "Notes",
};

const FEELING_LABEL: Record<string, string> = {
  GREAT: "Great",
  GOOD: "Good",
  AVERAGE: "Average",
  POOR: "Poor",
  VERY_POOR: "Very Poor",
};

export function AthleteThrowsRecap({ assignment }: { assignment: AssignmentWithRelations }) {
  const events = parseEvents(assignment.session.event);

  // Append T00:00:00 to force local-timezone parsing — bare ISO date strings
  // are parsed as UTC midnight, which shifts the day in negative-offset zones.
  const formattedDate = new Date(`${assignment.assignedDate}T00:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-6">
      <Link
        href="/athlete/throws/history"
        className="inline-flex items-center gap-1 text-sm text-surface-700 dark:text-surface-300 hover:text-[var(--foreground)] transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to History
      </Link>

      <div>
        <div className="flex gap-1 mb-2">
          {events.map((ev) => {
            const meta = EVENTS[ev];
            return (
              <span
                key={ev}
                className="text-xs font-bold px-2 py-0.5 rounded text-white"
                style={{ backgroundColor: meta?.color || "#666" }}
              >
                {meta?.label || ev}
              </span>
            );
          })}
        </div>
        <h1 className="text-display font-heading text-[var(--foreground)]">
          {assignment.session.name}
        </h1>
        <p className="text-sm text-muted mt-1">
          <span className="font-mono tabular-nums">{formattedDate}</span> ·{" "}
          {STATUS_LABEL[assignment.status] ?? assignment.status}
        </p>
      </div>

      <div className="space-y-4">
        {assignment.session.blocks.map((block) => {
          const blockLogs = assignment.throwLogs.filter((l) => l.blockId === block.id);
          return (
            <div key={block.id} className="card p-4">
              <h2 className="text-section font-heading text-[var(--foreground)]">
                {BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}
              </h2>
              {blockLogs.length === 0 ? (
                <p className="text-sm text-muted mt-2">No throws logged for this block.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {blockLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex justify-between text-sm text-surface-700 dark:text-surface-300"
                    >
                      <span>
                        <span className="font-mono tabular-nums">#{log.throwNumber}</span>
                        <span className="text-muted"> · </span>
                        {log.implement}
                      </span>
                      <span className="text-[var(--foreground)] font-mono tabular-nums font-semibold">
                        {log.distance != null ? `${log.distance.toFixed(2)}m` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {assignment.feedbackNotes && (
        <div className="card p-4">
          <h2 className="text-section font-heading text-[var(--foreground)]">Coach Feedback</h2>
          <p className="text-sm text-surface-700 dark:text-surface-300 mt-2 whitespace-pre-wrap">
            {assignment.feedbackNotes}
          </p>
        </div>
      )}

      {(assignment.rpe != null || assignment.selfFeeling) && (
        <div className="card p-4">
          <h2 className="text-section font-heading text-[var(--foreground)]">How It Felt</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
            {assignment.rpe != null && (
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">RPE</dt>
                <dd className="text-lg font-mono tabular-nums text-[var(--foreground)]">
                  {assignment.rpe}
                </dd>
              </div>
            )}
            {assignment.selfFeeling && (
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Feeling</dt>
                <dd className="text-sm text-[var(--foreground)]">
                  {FEELING_LABEL[assignment.selfFeeling] ?? assignment.selfFeeling}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {assignment.status === "SKIPPED" && assignment.skipReason && (
        <div className="card p-4">
          <p className="text-sm text-muted">
            <strong>Skip reason:</strong> {assignment.skipReason}
          </p>
        </div>
      )}
    </div>
  );
}
