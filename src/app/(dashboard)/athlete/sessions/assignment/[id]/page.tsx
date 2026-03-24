import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button } from "@/components";
import {
  ArrowLeft,
  Clock,
  Target,
  Dumbbell,
  Flame,
  Snowflake,
  StickyNote,
  Play,
  SkipForward,
  CalendarDays,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { AssignmentActions } from "./_assignment-actions";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

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

const BLOCK_ICON_MAP: Record<string, { icon: typeof Target; color: string; label: string }> = {
  WARMUP: { icon: Flame, color: "text-amber-500", label: "Warm-Up" },
  THROWING: { icon: Target, color: "text-orange-500", label: "Throwing" },
  STRENGTH: { icon: Dumbbell, color: "text-blue-500", label: "Strength" },
  PLYOMETRIC: { icon: Flame, color: "text-purple-500", label: "Plyometric" },
  COOLDOWN: { icon: Snowflake, color: "text-cyan-500", label: "Cool-Down" },
  NOTES: { icon: StickyNote, color: "text-surface-400", label: "Notes" },
};

/* ─── Block Renderers ───────────────────────────────────────────────────── */

function ThrowingBlockDetail({ config }: { config: Record<string, unknown> }) {
  const weight = config.implementWeight || config.implement || "";
  const throwCount = config.throwCount as number | undefined;
  const technique = config.techniqueFocus as string | undefined;
  const rpeMin = config.intensityMin as number | undefined;
  const rpeMax = config.intensityMax as number | undefined;
  const notes = config.notes as string | undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-sm">
        {weight && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium">
            {String(weight)}
          </span>
        )}
        {throwCount && (
          <span className="text-muted">
            {throwCount} throws
          </span>
        )}
        {technique && technique !== "FULL_THROW" && (
          <span className="text-muted capitalize">
            {technique.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
      </div>
      {(rpeMin || rpeMax) && (
        <p className="text-xs text-muted">
          RPE target: {rpeMin}–{rpeMax}%
        </p>
      )}
      {notes && (
        <p className="text-xs text-muted italic">{notes}</p>
      )}
    </div>
  );
}

function StrengthBlockDetail({ config }: { config: Record<string, unknown> }) {
  const exercises = (config.exercises as Array<Record<string, unknown>>) ?? [];

  if (exercises.length === 0) {
    return <p className="text-sm text-muted">No exercises specified</p>;
  }

  return (
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
  );
}

function WarmupCooldownDetail({ config }: { config: Record<string, unknown> }) {
  const duration = config.duration as number | undefined;
  const drills = (config.drills as string[]) ?? [];

  return (
    <div className="space-y-1">
      {duration && (
        <p className="text-sm text-muted">{duration} minutes</p>
      )}
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
      {!duration && drills.length === 0 && (
        <p className="text-sm text-muted">As needed</p>
      )}
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

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const assignment = await prisma.throwsAssignment.findUnique({
    where: { id },
    include: {
      session: {
        include: {
          blocks: { orderBy: { position: "asc" } },
        },
      },
      athlete: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });

  if (!assignment) notFound();

  // Verify caller has access
  const hasAccess = await canAccessAthlete(
    currentUser.userId,
    currentUser.role as "COACH" | "ATHLETE",
    assignment.athleteId,
  );
  if (!hasAccess) notFound();

  const session = assignment.session;
  const status = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.ASSIGNED;
  const isCompleted = assignment.status === "COMPLETED" || assignment.status === "PARTIAL";
  const isSkipped = assignment.status === "SKIPPED";
  const canStart = assignment.status === "ASSIGNED" || assignment.status === "NOTIFIED";
  const isInProgress = assignment.status === "IN_PROGRESS";

  // Count throws across blocks
  let totalThrows = 0;
  for (const block of session.blocks) {
    if (block.blockType === "THROWING") {
      try {
        const cfg = JSON.parse(block.config) as Record<string, unknown>;
        totalThrows += (cfg.throwCount as number) ?? 0;
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/athlete/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to Dashboard
      </Link>

      {/* Header card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-heading font-bold text-[var(--foreground)]">
              {session.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                {formatDate(assignment.assignedDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Target size={14} strokeWidth={1.75} aria-hidden="true" />
                {formatEventName(session.event)}
              </span>
              {session.estimatedDuration && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                  ~{session.estimatedDuration} min
                </span>
              )}
              {totalThrows > 0 && (
                <span className="tabular-nums">{totalThrows} throws total</span>
              )}
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

      {/* Session blocks */}
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
            } catch { /* ignore */ }

            return (
              <div
                key={block.id}
                className="card p-4 border-l-4"
                style={{
                  borderLeftColor:
                    block.blockType === "WARMUP" ? "var(--amber-500, #f59e0b)" :
                    block.blockType === "THROWING" ? "var(--orange-500, #f97316)" :
                    block.blockType === "STRENGTH" ? "var(--blue-500, #3b82f6)" :
                    block.blockType === "COOLDOWN" ? "var(--cyan-500, #06b6d4)" :
                    "var(--surface-400, #9ca3af)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={blockMeta.color}
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {blockMeta.label}
                  </h3>
                  <span className="text-xs text-muted ml-auto tabular-nums">
                    Block {idx + 1}
                  </span>
                </div>

                {block.blockType === "THROWING" && (
                  <ThrowingBlockDetail config={config} />
                )}
                {block.blockType === "STRENGTH" && (
                  <StrengthBlockDetail config={config} />
                )}
                {(block.blockType === "WARMUP" || block.blockType === "COOLDOWN") && (
                  <WarmupCooldownDetail config={config} />
                )}
                {block.blockType === "NOTES" && (
                  <NotesBlockDetail config={config} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      {!isCompleted && !isSkipped && (
        <AssignmentActions
          assignmentId={assignment.id}
          canStart={canStart}
          isInProgress={isInProgress}
        />
      )}

      {/* Completion feedback */}
      {isCompleted && assignment.rpe && (
        <div className="card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Session Feedback
          </h3>
          <div className="flex items-center gap-4 text-sm">
            {assignment.rpe && (
              <span>RPE: <strong className="tabular-nums">{assignment.rpe}/10</strong></span>
            )}
            {assignment.selfFeeling && (
              <span>Feeling: <strong className="capitalize">{assignment.selfFeeling.toLowerCase()}</strong></span>
            )}
          </div>
          {assignment.feedbackNotes && (
            <p className="text-sm text-muted">{assignment.feedbackNotes}</p>
          )}
        </div>
      )}

      {isSkipped && assignment.skipReason && (
        <div className="card p-4">
          <p className="text-sm text-muted">
            <strong>Skip reason:</strong> {assignment.skipReason}
          </p>
        </div>
      )}
    </div>
  );
}
