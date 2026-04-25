"use client";

import { useState, useEffect, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, CheckCircle2, Plus, Zap } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

interface PracticeSessionSummary {
  id: string;
  name: string;
  date: string;
  status: string;
  notes: string | null;
  createdAt: string;
  _count: { attempts: number };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LiveSessionsView() {
  const router = useRouter();
  const toast = useToast();
  const [sessions, setSessions] = useState<PracticeSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    fetch("/api/throws/practice")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSessions(data.data);
        setLoading(false);
      })
      .catch((err) => {
        logger.error("[calendar/live] fetch error", { error: err });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/throws/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          name: formName.trim(),
          date: today,
          notes: formNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Live session started");
        router.push(`/coach/throws/practice/${data.data.id}`);
      } else {
        toast.error(data.error || "Failed to create session");
        setCreating(false);
      }
    } catch (err) {
      logger.error("[calendar/live] create error", { error: err });
      toast.error("Failed to create session");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-spring-up space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-12 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => s.status === "ACTIVE");
  const closedSessions = sessions.filter((s) => s.status === "CLOSED");

  return (
    <div className="animate-spring-up space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-[var(--foreground)]">
            Live Sessions
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Sessions in progress. Open one to log attempts in real time.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setFormName(`Practice ${formatDate(today)}`);
          }}
          className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Start Practice
        </button>
      </div>

      {showForm && (
        <div className="card !p-5 border-2 border-[rgba(212,168,67,0.2)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--foreground)] text-sm">New Practice Session</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-muted hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                Session name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
                placeholder="e.g. Monday Morning Practice"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                Notes <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)] resize-none"
                placeholder="Focus areas, weather, venue…"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating || !formName.trim()}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-60"
              >
                <Zap size={14} strokeWidth={1.75} aria-hidden="true" />
                {creating ? "Starting…" : "Start Session"}
              </button>
            </div>
          </form>
        </div>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="card text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
            <Radio size={28} className="text-emerald-500" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)] text-sm">
              No practice sessions yet
            </p>
            <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
              Start a live session to log attempts, distances, drill types, and notes in real time.
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setFormName(`Practice ${formatDate(today)}`);
            }}
            className="btn-primary text-sm px-5 py-2 mx-auto"
          >
            Start Your First Session
          </button>
        </div>
      )}

      {activeSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </h3>
          {activeSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      {closedSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
            Past Sessions
          </h3>
          {closedSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: PracticeSessionSummary }) {
  const isActive = session.status === "ACTIVE";
  return (
    <Link
      href={`/coach/throws/practice/${session.id}`}
      className="card card-interactive !p-4 flex items-center gap-4 group"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isActive ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-[var(--muted-bg)]"
        }`}
      >
        {isActive ? (
          <Zap
            size={20}
            className="text-emerald-600 dark:text-emerald-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2 size={20} className="text-muted" strokeWidth={1.75} aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-[var(--foreground)] text-sm truncate">{session.name}</p>
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-surface-700 dark:text-surface-300">
            {formatDate(session.date)}
          </p>
          <p className="text-xs text-muted">
            {session._count.attempts} attempt{session._count.attempts !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
