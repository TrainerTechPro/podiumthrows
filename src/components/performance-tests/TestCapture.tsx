"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { TestIcon } from "./test-icon";
import { AttemptRow } from "./AttemptRow";
import { Plus, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import {
  decimalsForUnit,
  formatTestValueShort,
  recordedByDisplayName,
  type PerformanceTestAttemptDTO,
  type PerformanceTestSessionDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";

/* ── API helpers ──────────────────────────────────────────────────────────── */

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface ApiAttemptResult {
  attempt: PerformanceTestAttemptDTO;
  aggregates: { peakValue: number | null; avgValue: number | null; attemptCount: number };
  isAllTimePR?: boolean;
}

interface AttemptResponse extends PerformanceTestAttemptDTO {
  aggregates: ApiAttemptResult["aggregates"];
  isAllTimePR: boolean;
}

/* ── Props ────────────────────────────────────────────────────────────────── */

export interface TestCaptureProps {
  /** Athlete whose data we're recording for. */
  athleteId: string;
  /** Picked test type from Stage A (or pre-scoped on coach surface). */
  testType: PerformanceTestTypeDTO;
  /**
   * Surface variant. Athlete fires celebration toasts and big PR overlays;
   * coach fires quiet success toasts and skips celebrations per CLAUDE.md
   * dual-product rules.
   */
  surface: "athlete" | "coach";
  /** Optional pre-existing session to resume (rare). When omitted, the first
   * attempt POST creates a session implicitly via this component. */
  initialSession?: PerformanceTestSessionDTO;
  /** Called on successful Done. Fires once with the final session shape so
   * the parent can refresh trend / dashboard data. */
  onComplete?: (session: PerformanceTestSessionDTO | null) => void;
  /** Called when the user closes without recording. */
  onClose?: () => void;
}

interface SessionState {
  id: string;
  attempts: PerformanceTestAttemptDTO[];
  peakValue: number | null;
  avgValue: number | null;
  attemptCount: number;
  recordedById: string | null;
  recordedByRole: "ATHLETE" | "COACH" | null;
  recordedByName: string | null;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function TestCapture({
  athleteId,
  testType,
  surface,
  initialSession,
  onComplete,
  onClose,
}: TestCaptureProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<SessionState | null>(
    initialSession
      ? {
          id: initialSession.id,
          attempts: initialSession.attempts ?? [],
          peakValue: initialSession.peakValue,
          avgValue: initialSession.avgValue,
          attemptCount: initialSession.attemptCount,
          recordedById: initialSession.recordedById,
          recordedByRole: initialSession.recordedByRole,
          recordedByName: recordedByDisplayName(
            initialSession.recordedBy,
            initialSession.recordedByRole
          ),
        }
      : null
  );

  const [inputValue, setInputValue] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [busyAttemptIds, setBusyAttemptIds] = useState<Set<string>>(new Set());
  const [bestPr, setBestPr] = useState<{ value: number; isAllTime: boolean } | null>(null);

  // One stable idempotency key per "Add attempt" press. Reset after every
  // successful POST so the next attempt has a fresh key.
  const idempotencyKeyRef = useRef<string>(uuid());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  const decimals = useMemo(() => decimalsForUnit(testType.unit), [testType.unit]);

  const setBusy = useCallback((attemptId: string, busy: boolean) => {
    setBusyAttemptIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(attemptId);
      else next.delete(attemptId);
      return next;
    });
  }, []);

  /* ── Create session lazily on first attempt ───────────────────────────── */

  async function ensureSession(): Promise<SessionState | null> {
    if (session) return session;
    try {
      const res = await fetch(`/api/performance-tests/athletes/${athleteId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ testTypeId: testType.id }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || `Couldn't start session (${res.status})`);
        return null;
      }
      const created = payload.data as PerformanceTestSessionDTO;
      const initialState: SessionState = {
        id: created.id,
        attempts: [],
        peakValue: null,
        avgValue: null,
        attemptCount: 0,
        recordedById: created.recordedById,
        recordedByRole: created.recordedByRole,
        recordedByName: recordedByDisplayName(created.recordedBy, created.recordedByRole),
      };
      setSession(initialState);
      return initialState;
    } catch (err) {
      logger.error("performance-tests: ensureSession failed", {
        context: "performance-tests/capture",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
      return null;
    }
  }

  /* ── Add attempt ──────────────────────────────────────────────────────── */

  async function handleAdd() {
    const raw = inputValue.trim();
    if (raw === "") return;
    const value = parseFloat(raw);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid number");
      return;
    }

    setSubmittingAdd(true);
    const ensured = await ensureSession();
    if (!ensured) {
      setSubmittingAdd(false);
      return;
    }

    try {
      const res = await fetch(`/api/performance-tests/sessions/${ensured.id}/attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current,
          ...csrfHeaders(),
        },
        body: JSON.stringify({ value }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || `Couldn't add attempt (${res.status})`);
        return;
      }

      const result = payload.data as AttemptResponse;
      const attempt: PerformanceTestAttemptDTO = {
        id: result.id,
        sessionId: result.sessionId,
        attemptNumber: result.attemptNumber,
        value: result.value,
        isValid: result.isValid,
        notes: result.notes,
        lastEditedById: result.lastEditedById,
        lastEditedAt: result.lastEditedAt,
        createdAt: result.createdAt,
      };

      setSession((prev) =>
        prev
          ? {
              ...prev,
              attempts: [...prev.attempts, attempt],
              peakValue: result.aggregates.peakValue,
              avgValue: result.aggregates.avgValue,
              attemptCount: result.aggregates.attemptCount,
            }
          : prev
      );

      if (result.isAllTimePR) {
        setBestPr({ value: attempt.value, isAllTime: true });
      } else if (
        bestPr == null ||
        (testType.lowerIsBetter ? attempt.value < bestPr.value : attempt.value > bestPr.value)
      ) {
        setBestPr({ value: attempt.value, isAllTime: bestPr?.isAllTime ?? false });
      }

      // Clear and refocus for the next attempt. Fresh idempotency key.
      idempotencyKeyRef.current = uuid();
      setInputValue("");
      inputRef.current?.focus();
    } catch (err) {
      logger.error("performance-tests: add attempt failed", {
        context: "performance-tests/capture",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
    } finally {
      setSubmittingAdd(false);
    }
  }

  /* ── Edit / foul / delete ─────────────────────────────────────────────── */

  async function handleEdit(attemptId: string, value: number) {
    setBusy(attemptId, true);
    try {
      const res = await fetch(`/api/performance-tests/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ value }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Couldn't update attempt");
        return;
      }
      const { attempt: updated, aggregates } = payload.data as ApiAttemptResult;
      setSession((prev) =>
        prev
          ? {
              ...prev,
              attempts: prev.attempts.map((a) => (a.id === attemptId ? { ...a, ...updated } : a)),
              peakValue: aggregates.peakValue,
              avgValue: aggregates.avgValue,
              attemptCount: aggregates.attemptCount,
            }
          : prev
      );
    } catch (err) {
      logger.error("performance-tests: edit attempt failed", {
        context: "performance-tests/capture",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
    } finally {
      setBusy(attemptId, false);
    }
  }

  async function handleToggleFoul(attemptId: string, nextIsValid: boolean) {
    setBusy(attemptId, true);
    try {
      const res = await fetch(`/api/performance-tests/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ isValid: nextIsValid }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Couldn't update attempt");
        return;
      }
      const { attempt: updated, aggregates } = payload.data as ApiAttemptResult;
      setSession((prev) =>
        prev
          ? {
              ...prev,
              attempts: prev.attempts.map((a) => (a.id === attemptId ? { ...a, ...updated } : a)),
              peakValue: aggregates.peakValue,
              avgValue: aggregates.avgValue,
              attemptCount: aggregates.attemptCount,
            }
          : prev
      );
    } catch (err) {
      logger.error("performance-tests: toggle foul failed", {
        context: "performance-tests/capture",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
    } finally {
      setBusy(attemptId, false);
    }
  }

  async function handleDelete(attemptId: string) {
    setBusy(attemptId, true);
    try {
      const res = await fetch(`/api/performance-tests/attempts/${attemptId}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Couldn't delete attempt");
        return;
      }
      const aggregates = (payload.data as { aggregates: ApiAttemptResult["aggregates"] })
        .aggregates;
      setSession((prev) =>
        prev
          ? {
              ...prev,
              attempts: prev.attempts.filter((a) => a.id !== attemptId),
              peakValue: aggregates.peakValue,
              avgValue: aggregates.avgValue,
              attemptCount: aggregates.attemptCount,
            }
          : prev
      );
    } catch (err) {
      logger.error("performance-tests: delete attempt failed", {
        context: "performance-tests/capture",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
    } finally {
      setBusy(attemptId, false);
    }
  }

  /* ── Done ─────────────────────────────────────────────────────────────── */

  async function handleDone() {
    if (!session) {
      onClose?.();
      onComplete?.(null);
      return;
    }

    // Empty-session cleanup. If the user opened the sheet but never recorded a
    // valid attempt, drop the row server-side rather than leaving a shell.
    if (session.attempts.length === 0) {
      try {
        await fetch(`/api/performance-tests/sessions/${session.id}`, {
          method: "DELETE",
          headers: { ...csrfHeaders() },
        });
      } catch (err) {
        logger.warn("performance-tests: empty-session cleanup failed", {
          context: "performance-tests/capture",
          metadata: { err: err instanceof Error ? err.message : String(err) },
        });
      }
      onComplete?.(null);
      onClose?.();
      return;
    }

    // Surface the right toast variant. Athlete celebrates new PRs; coach is
    // quiet by design.
    if (surface === "athlete" && bestPr?.isAllTime && session.peakValue != null) {
      toast.celebration("New personal best", {
        highlight: formatTestValueShort(session.peakValue, testType.unit),
        description: `${testType.name} · ${session.attempts.length} attempt${session.attempts.length === 1 ? "" : "s"}`,
      });
    } else {
      toast.success(
        surface === "coach" ? "Test recorded" : "Test logged",
        session.peakValue != null
          ? `${testType.name} · best ${formatTestValueShort(session.peakValue, testType.unit)}`
          : testType.name
      );
    }

    // Compose the final session DTO for the parent to refresh from.
    const finalSession: PerformanceTestSessionDTO = {
      id: session.id,
      athleteId,
      testTypeId: testType.id,
      performedAt: new Date().toISOString(),
      recordedById: session.recordedById ?? "",
      recordedByRole: session.recordedByRole ?? "ATHLETE",
      notes: null,
      conditions: null,
      peakValue: session.peakValue,
      avgValue: session.avgValue,
      attemptCount: session.attemptCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testType,
      attempts: session.attempts,
    };

    onComplete?.(finalSession);
    onClose?.();
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  const validCount = session?.attempts.filter((a) => a.isValid).length ?? 0;
  const avgDisplay =
    session?.avgValue != null ? formatTestValueShort(session.avgValue, testType.unit) : "—";

  const showCoachAttribution =
    surface === "athlete" && session?.recordedByRole === "COACH" && session.recordedByName;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="rounded-lg bg-primary-500/10 text-primary-500 p-2 shrink-0">
            <TestIcon iconKey={testType.iconKey} size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold text-[var(--foreground)] truncate">
              {testType.name}
            </h2>
            <p className="text-xs text-muted">
              {testType.lowerIsBetter ? "Lower is better" : "Higher is better"} · {testType.unit}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Best</div>
          <div className="font-mono tabular-nums text-base font-semibold text-primary-500">
            {session?.peakValue != null ? (
              <NumberFlow value={session.peakValue} decimals={decimals} />
            ) : (
              "—"
            )}
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            avg <span className="font-mono tabular-nums">{avgDisplay}</span> · {validCount} valid
          </div>
        </div>
      </header>

      {showCoachAttribution && (
        <div className="rounded-lg bg-primary-500/5 border border-primary-500/20 px-3 py-2 text-xs text-muted">
          Logged by {session.recordedByName}
        </div>
      )}

      {/* Numeric input + Add attempt */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
          Attempt {(session?.attempts.length ?? 0) + 1}
        </label>
        <div className="flex items-stretch gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step={testType.unit === "sec" ? "0.01" : "0.1"}
            min="0"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
            placeholder={testType.unit === "cm" ? "72.0" : "1.78"}
            className="input flex-1 font-mono tabular-nums text-lg"
            aria-label={`${testType.name} value in ${testType.unit}`}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={submittingAdd || inputValue.trim() === ""}
            className="btn-primary inline-flex items-center gap-1.5 px-4"
          >
            {submittingAdd ? (
              <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
            )}
            Add
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {testType.unit === "cm"
            ? "Centimeters. Tip: 1 in ≈ 2.54 cm"
            : "Seconds with two decimals (1.78)"}
        </p>
      </div>

      {/* Attempts list */}
      {session && session.attempts.length > 0 ? (
        <div className="space-y-2">
          {session.attempts.map((a) => (
            <AttemptRow
              key={a.id}
              attempt={a}
              testType={testType}
              busy={busyAttemptIds.has(a.id)}
              onEdit={handleEdit}
              onToggleFoul={handleToggleFoul}
              onDelete={handleDelete}
            />
          ))}
          <p className="text-[11px] text-muted text-center pt-1">
            Swipe a row left for foul or delete
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] px-4 py-6 text-center text-sm text-muted">
          No attempts yet. Enter a value above and tap Add.
        </div>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 pt-3 border-t border-[var(--card-border)] bg-[var(--surface-overlay)]">
        <button
          type="button"
          onClick={() => {
            void handleDone();
          }}
          className="text-sm font-medium text-muted hover:text-[var(--foreground)] transition-colors"
        >
          {session && session.attempts.length === 0 ? "Cancel" : "Close"}
        </button>
        <button
          type="button"
          onClick={() => void handleDone()}
          disabled={submittingAdd}
          className="btn-primary"
        >
          Done
        </button>
      </div>
    </div>
  );
}
