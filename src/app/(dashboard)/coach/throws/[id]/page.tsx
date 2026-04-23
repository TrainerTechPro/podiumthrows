import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge, Avatar, AnimatedNumber, ScrollProgressBar } from "@/components";
import {
  ArrowLeft,
  Clock,
  Target,
  Dumbbell,
  Flame,
  Snowflake,
  StickyNote,
  CalendarDays,
  Timer,
} from "lucide-react";
import { requireCoachSession, getAssignmentDetailForCoach } from "@/lib/data/coach";
import { CommentThread } from "@/components/comment-thread";

export const dynamic = "force-dynamic";

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDuration(startedAt: Date | null, completedAt: Date | null): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = completedAt.getTime() - startedAt.getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" }
> = {
  ASSIGNED: { label: "Assigned", variant: "info" },
  NOTIFIED: { label: "Notified", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  PARTIAL: { label: "Partial", variant: "warning" },
  SKIPPED: { label: "Skipped", variant: "danger" },
};

const FEELING_CONFIG: Record<string, { label: string; colorClass: string }> = {
  GREAT: {
    label: "Great",
    colorClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  GOOD: {
    label: "Good",
    colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  AVERAGE: {
    label: "Average",
    colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  POOR: {
    label: "Poor",
    colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  VERY_POOR: {
    label: "Very Poor",
    colorClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const BLOCK_ICON_MAP: Record<
  string,
  { icon: typeof Target; color: string; label: string; borderColor: string }
> = {
  WARMUP: {
    icon: Flame,
    color: "text-amber-500",
    label: "Warm-Up",
    borderColor: "var(--amber-500, #f59e0b)",
  },
  THROWING: {
    icon: Target,
    color: "text-orange-500",
    label: "Throwing",
    borderColor: "var(--orange-500, #f97316)",
  },
  STRENGTH: {
    icon: Dumbbell,
    color: "text-blue-500",
    label: "Strength",
    borderColor: "var(--blue-500, #3b82f6)",
  },
  PLYOMETRIC: {
    icon: Flame,
    color: "text-purple-500",
    label: "Plyometric",
    borderColor: "var(--purple-500, #a855f7)",
  },
  COOLDOWN: {
    icon: Snowflake,
    color: "text-cyan-500",
    label: "Cool-Down",
    borderColor: "var(--cyan-500, #06b6d4)",
  },
  NOTES: {
    icon: StickyNote,
    color: "text-surface-400",
    label: "Notes",
    borderColor: "var(--surface-400, #9ca3af)",
  },
};

function ThrowingBlockResults({
  config,
  throwLogs,
  prescribedCount,
}: {
  config: Record<string, unknown>;
  throwLogs: Array<{
    throwNumber: number;
    distance: number | null;
    implement: string;
    notes: string | null;
  }>;
  prescribedCount: number;
}) {
  const weight = config.implementWeight || config.implement || "";
  const technique = config.techniqueFocus as string | undefined;
  const rpeMin = config.intensityMin as number | undefined;
  const rpeMax = config.intensityMax as number | undefined;

  const distances = throwLogs.map((l) => l.distance).filter((d): d is number => d != null);
  const bestMark = distances.length > 0 ? Math.max(...distances) : null;
  const avgDistance =
    distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : null;
  const actualCount = throwLogs.length;

  const completionColor =
    prescribedCount > 0
      ? actualCount >= prescribedCount
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-amber-600 dark:text-amber-400"
      : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {weight && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium">
            {String(weight)}
          </span>
        )}
        {technique && technique !== "FULL_THROW" && (
          <span className="text-muted capitalize">
            {technique.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
        {(rpeMin || rpeMax) && (
          <span className="text-xs text-muted">
            RPE target: {rpeMin}–{rpeMax}
          </span>
        )}
      </div>

      {prescribedCount > 0 && (
        <p className={cn("text-xs font-medium", completionColor)}>
          {actualCount} of {prescribedCount} throws completed
        </p>
      )}

      {throwLogs.length > 0 ? (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider py-2 pr-4">
                  #
                </th>
                <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider py-2 pr-4">
                  Distance
                </th>
                <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider py-2 pr-4">
                  Implement
                </th>
                <th className="text-left text-xs font-semibold text-muted uppercase tracking-wider py-2">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {throwLogs.map((log) => {
                const isBest = log.distance != null && log.distance === bestMark;
                return (
                  <tr
                    key={log.throwNumber}
                    className="border-b border-[var(--card-border)] last:border-0"
                  >
                    <td className="py-2 pr-4 tabular-nums text-muted">{log.throwNumber}</td>
                    <td
                      className={cn(
                        "py-2 pr-4 tabular-nums font-semibold",
                        isBest
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-[var(--foreground)]"
                      )}
                    >
                      {log.distance != null ? `${log.distance.toFixed(2)}m` : "—"}
                      {isBest && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase">Best</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted">{log.implement}</td>
                    <td className="py-2 text-muted text-xs">{log.notes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted italic">No throws logged for this block</p>
      )}

      {distances.length > 0 && (
        <div className="flex gap-6 text-xs text-muted pt-1">
          <span>
            Best:{" "}
            <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
              {bestMark!.toFixed(2)}m
            </strong>
          </span>
          <span>
            Avg:{" "}
            <strong className="text-[var(--foreground)] tabular-nums">
              {avgDistance!.toFixed(2)}m
            </strong>
          </span>
          <span>
            Throws: <strong className="tabular-nums">{actualCount}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function StrengthBlockPrescription({ config }: { config: Record<string, unknown> }) {
  const exercises = (config.exercises as Array<Record<string, unknown>>) ?? [];
  if (exercises.length === 0) {
    return <p className="text-sm text-muted">No exercises specified</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted italic mb-2">Prescribed (strength logging coming soon)</p>
      <div className="space-y-1.5">
        {exercises.map((ex, i) => {
          const name = (ex.name as string) || "Exercise";
          const sets = ex.sets as number | undefined;
          const reps = ex.reps as number | undefined;
          const pct = ex.percentage as number | undefined;
          return (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--foreground)] font-medium">{name}</span>
              <span className="text-muted tabular-nums">
                {sets && reps ? `${sets} × ${reps}` : "—"}
                {pct ? ` @ ${pct}%` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WarmupCooldownDetail({ config }: { config: Record<string, unknown> }) {
  const duration = config.duration as number | undefined;
  const drills = (config.drills as string[]) ?? [];
  return (
    <div className="space-y-1">
      {duration && <p className="text-sm text-muted">{duration} minutes</p>}
      {drills.length > 0 && (
        <ul className="text-sm text-muted space-y-0.5">
          {drills.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-surface-300 dark:bg-surface-600 shrink-0" />
              {d}
            </li>
          ))}
        </ul>
      )}
      {!duration && drills.length === 0 && <p className="text-sm text-muted">As needed</p>}
    </div>
  );
}

function NotesBlockDetail({ config }: { config: Record<string, unknown> }) {
  const text = (config.text as string) ?? "";
  return text ? (
    <p className="text-sm text-muted whitespace-pre-wrap">{text}</p>
  ) : (
    <p className="text-sm text-muted italic">No notes</p>
  );
}

export default async function CoachThrowsAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;

  const { coach } = await requireCoachSession();

  // Permissions are enforced via the assignment itself — the coach must own
  // the athlete the assignment belongs to. The optional `?athlete=` search
  // param is for breadcrumb/display only and is not consulted here.
  const assignment = await getAssignmentDetailForCoach(assignmentId);

  if (!assignment) notFound();
  if (assignment.athlete.coachId !== coach.id) notFound();

  const athleteId = assignment.athleteId;
  const session = assignment.session;
  const athlete = assignment.athlete;
  const status = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.ASSIGNED;
  const feeling = assignment.selfFeeling ? FEELING_CONFIG[assignment.selfFeeling] : null;
  const duration = formatDuration(assignment.startedAt, assignment.completedAt);

  const throwLogsByBlock = new Map<string, typeof assignment.throwLogs>();
  for (const log of assignment.throwLogs) {
    const existing = throwLogsByBlock.get(log.blockId) ?? [];
    existing.push(log);
    throwLogsByBlock.set(log.blockId, existing);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ScrollProgressBar />

      <Link
        href={`/coach/athletes/${athleteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to Athlete
      </Link>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Avatar
              name={`${athlete.firstName} ${athlete.lastName}`}
              src={athlete.avatarUrl}
              size="md"
            />
            <div className="space-y-1">
              <h1 className="text-xl font-heading font-bold text-[var(--foreground)]">
                {session.name}
              </h1>
              <p className="text-sm text-muted">
                {athlete.firstName} {athlete.lastName}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                  {formatDate(assignment.assignedDate)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Target size={14} strokeWidth={1.75} aria-hidden="true" />
                  {formatEventName(session.event)}
                </span>
                {duration && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                    {duration}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        </div>

        {session.notes && (
          <p className="text-sm text-muted border-t border-[var(--card-border)] pt-3">
            {session.notes}
          </p>
        )}
      </div>

      {(assignment.rpe != null || feeling || assignment.feedbackNotes) && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Athlete Feedback
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            {feeling && (
              <span
                className={cn("text-sm font-semibold px-3 py-1 rounded-lg", feeling.colorClass)}
              >
                {feeling.label}
              </span>
            )}
            {assignment.rpe != null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">RPE</span>
                <span className="text-2xl font-heading font-bold text-[var(--foreground)] tabular-nums">
                  <AnimatedNumber value={assignment.rpe} decimals={0} />
                </span>
                <span className="text-sm text-muted">/10</span>
              </div>
            )}
          </div>
          {assignment.feedbackNotes && (
            <p className="text-sm text-surface-600 dark:text-surface-400 border-t border-[var(--card-border)] pt-3">
              {assignment.feedbackNotes}
            </p>
          )}
        </div>
      )}

      {(assignment.startedAt || assignment.completedAt) && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Timeline</h2>
          <div className="flex items-center gap-3 text-sm">
            <Timer
              size={14}
              strokeWidth={1.75}
              className="text-muted shrink-0"
              aria-hidden="true"
            />
            <div className="flex items-center gap-4 flex-wrap text-muted tabular-nums">
              {assignment.startedAt && (
                <span>
                  Started:{" "}
                  <strong className="text-[var(--foreground)]">
                    {formatTime(assignment.startedAt)}
                  </strong>
                </span>
              )}
              {assignment.completedAt && (
                <span>
                  Completed:{" "}
                  <strong className="text-[var(--foreground)]">
                    {formatTime(assignment.completedAt)}
                  </strong>
                </span>
              )}
              {duration && (
                <span>
                  Duration: <strong className="text-[var(--foreground)]">{duration}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Session Breakdown
        </h2>

        <div className="space-y-2">
          {session.blocks.map((block, idx) => {
            const blockMeta = BLOCK_ICON_MAP[block.blockType] ?? BLOCK_ICON_MAP.NOTES;
            const Icon = blockMeta.icon;
            let config: Record<string, unknown> = {};
            try {
              config = JSON.parse(block.config) as Record<string, unknown>;
            } catch {
              /* ignore */
            }

            const blockThrows = throwLogsByBlock.get(block.id) ?? [];
            const prescribedCount =
              block.blockType === "THROWING" ? ((config.throwCount as number) ?? 0) : 0;

            return (
              <div
                key={block.id}
                className="card p-5 border-l-4"
                style={{ borderLeftColor: blockMeta.borderColor }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={blockMeta.color}
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {blockMeta.label}
                  </h3>
                  <span className="text-xs text-muted ml-auto tabular-nums">Block {idx + 1}</span>
                </div>

                {block.blockType === "THROWING" && (
                  <ThrowingBlockResults
                    config={config}
                    throwLogs={blockThrows}
                    prescribedCount={prescribedCount}
                  />
                )}
                {block.blockType === "STRENGTH" && <StrengthBlockPrescription config={config} />}
                {(block.blockType === "WARMUP" || block.blockType === "COOLDOWN") && (
                  <WarmupCooldownDetail config={config} />
                )}
                {block.blockType === "NOTES" && <NotesBlockDetail config={config} />}
              </div>
            );
          })}
        </div>
      </div>

      {assignment.status === "SKIPPED" && assignment.skipReason && (
        <div className="card p-5">
          <p className="text-sm text-muted">
            <strong>Skip reason:</strong> {assignment.skipReason}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Comments</h2>
        <CommentThread targetField="throwsAssignmentId" targetId={assignmentId} />
      </div>
    </div>
  );
}
