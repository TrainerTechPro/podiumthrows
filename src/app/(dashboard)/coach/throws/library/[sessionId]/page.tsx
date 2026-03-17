"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EVENTS, TRAINING_PHASES, parseEvents, type ThrowEvent, type TrainingPhase } from "@/lib/throws/constants";
import { csrfHeaders } from "@/lib/csrf-client";

const PHASE_COLORS: Record<TrainingPhase, string> = {
  ACCUMULATION: "#6A9FD8",
  TRANSMUTATION: "#5BB88A",
  REALIZATION: "#D4915A",
  COMPETITION: "#D46A6A",
};

const BLOCK_LABELS: Record<string, { label: string; icon: string }> = {
  WARMUP: { label: "Warm-up", icon: "🔥" },
  THROWING: { label: "Throwing", icon: "🎯" },
  STRENGTH: { label: "Strength", icon: "🏋️" },
  PLYOMETRIC: { label: "Plyometric", icon: "⚡" },
  COOLDOWN: { label: "Cool-down", icon: "❄️" },
  NOTES: { label: "Notes", icon: "📝" },
};

interface Block {
  id: string;
  blockType: string;
  position: number;
  config: string;
}

interface Assignment {
  id: string;
  status: string;
  assignedDate: string;
  athlete: { id: string; firstName: string; lastName: string };
}

interface SessionDetail {
  id: string;
  name: string;
  event: string;
  sessionType: string;
  targetPhase: string | null;
  estimatedDuration: number | null;
  tags: string | null;
  notes: string | null;
  createdAt: string;
  blocks: Block[];
  assignments: Assignment[];
}

function ThrowingBlockDetail({ config }: { config: Record<string, unknown> }) {
  const implement = config.implement ? String(config.implement) : "";
  const technique = config.technique ? String(config.technique).replace(/_/g, " ") : "";
  const throwCount = config.throwCount ? String(config.throwCount) : "";
  const restSeconds = config.restSeconds ? String(config.restSeconds) : "";
  const notes = config.notes ? String(config.notes) : "";

  return (
    <div className="space-y-1 text-xs">
      {implement && (
        <p><span className="text-[var(--color-text-3)]">Implement:</span> <span className="font-medium">{implement}</span></p>
      )}
      {technique && (
        <p><span className="text-[var(--color-text-3)]">Technique:</span> <span className="font-medium">{technique}</span></p>
      )}
      {throwCount && (
        <p><span className="text-[var(--color-text-3)]">Throws:</span> <span className="font-medium tabular-nums">{throwCount}</span></p>
      )}
      {restSeconds && (
        <p><span className="text-[var(--color-text-3)]">Rest:</span> <span className="font-medium tabular-nums">{restSeconds}s</span></p>
      )}
      {notes && (
        <p className="text-[var(--color-text-2)] italic mt-1">{notes}</p>
      )}
    </div>
  );
}

function StrengthBlockDetail({ config }: { config: Record<string, unknown> }) {
  const exercises = (config.exercises ?? []) as Record<string, unknown>[];
  const notes = config.notes ? String(config.notes) : "";
  return (
    <div className="space-y-2 text-xs">
      {exercises.map((ex, i) => {
        const name = String(ex.name || ex.exerciseName || `Exercise ${i + 1}`);
        const sets = ex.sets ? String(ex.sets) : "";
        const reps = ex.reps ? String(ex.reps) : "";
        const weight = ex.weight ? String(ex.weight) : "";
        return (
          <div key={i} className="flex items-baseline gap-2">
            <span className="font-medium text-[var(--color-text)]">{name}</span>
            <span className="text-[var(--color-text-3)] tabular-nums">
              {sets && `${sets}×`}{reps}{weight && ` @ ${weight}`}
            </span>
          </div>
        );
      })}
      {exercises.length === 0 && notes && (
        <p className="text-[var(--color-text-2)]">{notes}</p>
      )}
    </div>
  );
}

function GenericBlockDetail({ config }: { config: Record<string, unknown> }) {
  if (config.notes) {
    return <p className="text-xs text-[var(--color-text-2)]">{String(config.notes)}</p>;
  }
  if (config.description) {
    return <p className="text-xs text-[var(--color-text-2)]">{String(config.description)}</p>;
  }
  return null;
}

export default function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/throws/sessions/${params.sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSession(data.data);
        else setError(data.error ?? "Failed to load session");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, [params.sessionId]);

  async function handleDelete() {
    if (!confirm("Delete this session template? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/throws/sessions/${params.sessionId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/coach/throws/library");
      } else {
        setError(data.error ?? "Failed to delete");
        setDeleting(false);
      }
    } catch {
      setError("Network error");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-[var(--color-bg-subtle)] rounded" />
        <div className="h-8 w-64 bg-[var(--color-bg-subtle)] rounded" />
        <div className="card p-5 space-y-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-[var(--color-bg-subtle)] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/coach/throws/library" className="text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)] flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Library
        </Link>
        <div className="card py-12 text-center">
          <p className="text-[var(--color-text-3)]">{error || "Session not found"}</p>
        </div>
      </div>
    );
  }

  const sessionEvents = parseEvents(session.event);
  const phase = session.targetPhase as TrainingPhase | null;
  const tags: string[] = session.tags ? JSON.parse(session.tags) : [];
  const completedAssignments = session.assignments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-spring-up">
      {/* Back link */}
      <Link href="/coach/throws/library" className="text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)] flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Library
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-outfit)" }}>
            {session.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {sessionEvents.map((ev) => {
              const meta = EVENTS[ev];
              return (
                <span key={ev} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: meta?.color || "#666" }}>
                  {meta?.label || ev}
                </span>
              );
            })}
            <span className="text-xs text-[var(--color-text-3)]">{session.sessionType.replace(/_/g, " ")}</span>
            {phase && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: PHASE_COLORS[phase], backgroundColor: `${PHASE_COLORS[phase]}15` }}>
                {TRAINING_PHASES.find((p) => p.value === phase)?.label ?? phase}
              </span>
            )}
            {session.estimatedDuration && (
              <span className="text-xs text-[var(--color-text-3)]">~{session.estimatedDuration} min</span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      {/* Notes */}
      {session.notes && (
        <div className="card p-4">
          <p className="text-sm text-[var(--color-text-2)]">{session.notes}</p>
        </div>
      )}

      {/* Blocks */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">
          Session Blocks ({session.blocks.length})
        </h2>
        <div className="space-y-3">
          {session.blocks.map((block, i) => {
            const meta = BLOCK_LABELS[block.blockType] ?? { label: block.blockType, icon: "📋" };
            let config: Record<string, unknown> = {};
            try { config = JSON.parse(block.config); } catch { /* empty */ }

            return (
              <div key={block.id} className="card !p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider">
                    Block {i + 1} — {meta.label}
                  </span>
                </div>
                {block.blockType === "THROWING" && <ThrowingBlockDetail config={config} />}
                {block.blockType === "STRENGTH" && <StrengthBlockDetail config={config} />}
                {!["THROWING", "STRENGTH"].includes(block.blockType) && <GenericBlockDetail config={config} />}
              </div>
            );
          })}
          {session.blocks.length === 0 && (
            <div className="card py-8 text-center">
              <p className="text-sm text-[var(--color-text-3)]">No blocks defined</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignments */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">
          Assignments ({session.assignments.length})
          {completedAssignments > 0 && (
            <span className="text-[var(--color-text-3)] font-normal ml-2">
              {completedAssignments} completed
            </span>
          )}
        </h2>
        {session.assignments.length > 0 ? (
          <div className="card divide-y divide-[var(--color-border)] overflow-hidden">
            {session.assignments.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {a.athlete.firstName} {a.athlete.lastName}
                  </p>
                  <p className="text-xs text-[var(--color-text-3)]">
                    {new Date(a.assignedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  a.status === "COMPLETED" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                  a.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                  a.status === "SKIPPED" ? "bg-red-500/10 text-red-500" :
                  "bg-[var(--color-bg-subtle)] text-[var(--color-text-3)]"
                }`}>
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card py-8 text-center">
            <p className="text-sm text-[var(--color-text-3)]">Not assigned to any athletes yet</p>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <p className="text-xs text-[var(--color-text-3)]">
        Created {new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}
