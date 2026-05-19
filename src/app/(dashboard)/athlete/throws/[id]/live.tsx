import Link from "next/link";
import { Badge } from "@/components";
import {
  ArrowLeft,
  Clock,
  Target,
  Dumbbell,
  Flame,
  Snowflake,
  StickyNote,
  CalendarDays,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { AssignmentActions } from "../../sessions/assignment/[id]/_assignment-actions";
import { LiveWorkout } from "../live/[assignmentId]/_live-workout";
import type { Prisma } from "@prisma/client";

type AssignmentWithRelations = Prisma.ThrowsAssignmentGetPayload<{
  include: {
    session: { include: { blocks: true } };
    throwLogs: true;
    athlete: { include: { user: { select: { id: true; email: true } } } };
  };
}>;

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
  WARMUP: { icon: Flame, color: "text-primary-500", label: "Warm-Up" },
  THROWING: { icon: Target, color: "text-warning-500", label: "Throwing" },
  STRENGTH: { icon: Dumbbell, color: "text-info-500", label: "Strength" },
  PLYOMETRIC: { icon: Flame, color: "text-purple-500", label: "Plyometric" },
  COOLDOWN: { icon: Snowflake, color: "text-info-500", label: "Cool-Down" },
  NOTES: { icon: StickyNote, color: "text-surface-400", label: "Notes" },
};

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 font-medium">
            {String(weight)}
          </span>
        )}
        {throwCount && <span className="text-muted">{throwCount} throws</span>}
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
      {notes && <p className="text-xs text-muted italic">{notes}</p>}
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

function PreStartView({ assignment }: { assignment: AssignmentWithRelations }) {
  const session = assignment.session;
  const status = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.ASSIGNED;
  const canStart = assignment.status === "ASSIGNED" || assignment.status === "NOTIFIED";
  const isInProgress = assignment.status === "IN_PROGRESS";
  const isTerminal =
    assignment.status === "COMPLETED" ||
    assignment.status === "PARTIAL" ||
    assignment.status === "SKIPPED";

  let totalThrows = 0;
  for (const block of session.blocks) {
    if (block.blockType === "THROWING") {
      try {
        const cfg = JSON.parse(block.config) as Record<string, unknown>;
        totalThrows += (cfg.throwCount as number) ?? 0;
      } catch (err) {
        logger.warn("Malformed THROWING block config JSON", {
          metadata: {
            blockId: block.id,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/athlete/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to Dashboard
      </Link>

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
                  <Clock size={14} strokeWidth={1.75} aria-hidden="true" />~
                  {session.estimatedDuration} min
                </span>
              )}
              {totalThrows > 0 && <span className="tabular-nums">{totalThrows} throws total</span>}
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
            } catch (err) {
              logger.warn("Malformed block config JSON", {
                metadata: {
                  blockId: block.id,
                  blockType: block.blockType,
                  error: err instanceof Error ? err.message : String(err),
                },
              });
            }

            return (
              <div
                key={block.id}
                className="card p-4 border-l-4"
                style={{
                  borderLeftColor:
                    block.blockType === "WARMUP"
                      ? "var(--amber-500, #f59e0b)"
                      : block.blockType === "THROWING"
                        ? "var(--orange-500, #f97316)"
                        : block.blockType === "STRENGTH"
                          ? "var(--blue-500, #3b82f6)"
                          : block.blockType === "COOLDOWN"
                            ? "var(--cyan-500, #06b6d4)"
                            : "var(--surface-400, #9ca3af)",
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
                  <span className="text-xs text-muted ml-auto tabular-nums">Block {idx + 1}</span>
                </div>

                {block.blockType === "THROWING" && <ThrowingBlockDetail config={config} />}
                {block.blockType === "STRENGTH" && <StrengthBlockDetail config={config} />}
                {(block.blockType === "WARMUP" || block.blockType === "COOLDOWN") && (
                  <WarmupCooldownDetail config={config} />
                )}
                {block.blockType === "NOTES" && <NotesBlockDetail config={config} />}
              </div>
            );
          })}
        </div>
      </div>

      {!isTerminal && (
        <AssignmentActions
          assignmentId={assignment.id}
          canStart={canStart}
          isInProgress={isInProgress}
        />
      )}
    </div>
  );
}

export function AthleteThrowsLive({ assignment }: { assignment: AssignmentWithRelations }) {
  if (assignment.status === "IN_PROGRESS") {
    const data = {
      assignmentId: assignment.id,
      status: assignment.status,
      sessionName: assignment.session.name,
      event: assignment.session.event,
      sessionType: assignment.session.sessionType,
      blocks: assignment.session.blocks.map((b) => ({
        id: b.id,
        blockType: b.blockType,
        position: b.position,
        config: b.config,
      })),
      existingThrowLogs: assignment.throwLogs.map((tl) => ({
        id: tl.id,
        blockId: tl.blockId,
        throwNumber: tl.throwNumber,
        distance: tl.distance,
        implement: tl.implement,
        notes: tl.notes,
      })),
      startedAt: assignment.startedAt?.toISOString() ?? null,
    };
    return <LiveWorkout data={data} />;
  }

  return <PreStartView assignment={assignment} />;
}
