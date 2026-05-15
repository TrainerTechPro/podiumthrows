"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localToday, formatEventType } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { WIRE_LENGTH_OPTIONS, DEFAULT_DRILL_BY_EVENT, LBS_TO_KG } from "@/lib/throws";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { SaveStatusChip } from "@/components/ui/SaveStatusChip";
import { useDraftResumeToast } from "@/components/ui/DraftResumeToast";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { enqueueMutation, useOutboxStatus } from "@/lib/outbox";
import { haptic } from "@/lib/haptic";
import { track } from "@/lib/analytics";
import { bumpLogsSubmitted } from "@/lib/pwa/install-counters";
import { ArrowLeft, Plus, X, CheckCircle2, Trophy, AlertTriangle, WifiOff } from "lucide-react";
import { ImplementPicker, type ImplementCatalogRow } from "@/components/throws/ImplementPicker";
import type { ImplementType } from "@prisma/client";

import { logger } from "@/lib/logger";
import { reportApiError } from "@/lib/form-errors";
import type { MilestoneCelebration } from "@/lib/goals/milestones";
/* ─── Log Session — single-screen form (no wizard) ───────────────────────────
   Consumer-app pattern: one scrollable form with a sticky thumb-zone Save.
   Athletes log multiple sessions a week; wizards are friction on high-frequency
   flows. Readiness moved to the home hero (state A). Technique/mental/best-part/
   improvement-area fields removed — rarely filled, always noise. What's left:
   event, drills, optional RPE + feeling + notes. Save.

   Shared with the coach log-session page via the apiEndpoint prop.
   ─────────────────────────────────────────────────────────────────────── */

/* ── Parsers that preserve 0 as a valid value (athletes log 0kg, 0.00m, 0 RPE) */
function parseNumericField(raw: string): number | undefined {
  if (raw === "" || raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntField(raw: string): number | undefined {
  if (raw === "" || raw == null) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/* ─── Constants ───────────────────────────────────────────────────────── */

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot put", color: "#ff8a3d" },
  { value: "DISCUS", label: "Discus", color: "#8b5cf6" },
  { value: "HAMMER", label: "Hammer", color: "#ef4444" },
  { value: "JAVELIN", label: "Javelin", color: "#22c55e" },
  // Weight-throw sessions log work against custom non-traditional implements
  // (tires, plates, weighted balls). Server allows the event string but
  // doesn't attribute PRs against a traditional EventType — see
  // /api/athlete/log-session WEIGHT_THROW guards.
  { value: "WEIGHT_THROW", label: "Weight throw", color: "#a3a3a3" },
] as const;

const FOCUS_OPTIONS = [
  "Technique",
  "Power",
  "Speed",
  "Volume",
  "Competition Sim",
  "Recovery / Light",
];

const FEELING_OPTIONS = [
  { value: "GREAT", label: "Great", tone: "var(--color-status-success-fg)" },
  { value: "GOOD", label: "Good", tone: "var(--color-status-success-fg)" },
  { value: "OK", label: "OK", tone: "var(--color-text-secondary)" },
  { value: "POOR", label: "Poor", tone: "var(--color-status-warning-fg)" },
  { value: "BAD", label: "Bad", tone: "var(--color-status-danger-fg)" },
];

const DRILLS_BY_EVENT: Record<string, string[]> = {
  SHOT_PUT: [
    "Full Throw",
    "Standing Throw",
    "Power Position",
    "Half Turn",
    "Glide (Full)",
    "Spin / Rotational",
    "South African Drill",
    "Reverse Stand",
    "Hip Pop Drill",
    "A-Drill",
    "Wrist Flips",
    "Other",
  ],
  DISCUS: [
    "Full Throw",
    "Standing Throw",
    "Power Position",
    "Half Turn",
    "South African Drill",
    "Wind-up Drill",
    "1.5 Turn",
    "Bowling Drill",
    "Non-Reverse",
    "Other",
  ],
  HAMMER: [
    "Winds Only",
    "Standing Throw",
    "1 Turn",
    "2 Turns",
    "3 Turns",
    "Full Throw (4 Turns)",
    "Full Throw (3 Turns)",
    "Power Throw",
    "Drill Throws",
    "Other",
  ],
  JAVELIN: [
    "Full Throw",
    "Standing Throw",
    "3-Step Approach",
    "5-Step Approach",
    "Full Approach",
    "Cross-over Drill",
    "Block Drill",
    "Run-through",
    "Into the Ground",
    "Other",
  ],
  WEIGHT_THROW: ["Full Throw", "Standing Throw", "Power Position", "Other"],
};

/* ─── Types ────────────────────────────────────────────────────────────── */

interface DrillEntry {
  id: string;
  drillType: string;
  /** Catalog row id when picked via ImplementPicker. Sent to the server so
   *  custom implements (3/4 wire hammers, tires, plates) resolve cleanly
   *  without the weight-fuzzy match that can't disambiguate variants. */
  implementId: string | null;
  implementWeight: string;
  implementUnit: "kg" | "lbs";
  wireLength: string;
  throwCount: string;
  bestMark: string;
  // Per-drill distance unit — athletes throw shot in feet and hammer in meters,
  // so one form-wide toggle forces mental conversions. See tester feedback
  // 2026-03-18 and the 2026-04-20 fix that moved this off form state.
  distanceUnit: "meters" | "feet";
  notes: string;
}

interface WizardProps {
  /** From the server session — scopes the IDB draft cache. Optional so this
   *  wizard can still be reused from the coach surface (which doesn't carry
   *  athlete user-id context) — when omitted, draft persistence is disabled. */
  userId?: string;
  /** Athlete profile id — when present, drill rows render the catalog
   *  ImplementPicker as a one-tap alternative to typing the kg/lb manually.
   *  Coach-on-behalf surfaces should pass the target athlete's id. */
  athleteId?: string;
  /** API endpoint for saving (athlete or coach-on-behalf) */
  apiEndpoint?: string;
  /** Where to navigate on cancel / "view sessions" */
  sessionsPath?: string;
  /** Only show these events (empty/undefined = show all) */
  allowedEvents?: string[];
  /** If set, loads existing session data and PUTs the update */
  editSessionId?: string;
}

/** Form state shape persisted to IndexedDB across reloads / tab kills. */
interface LogSessionDraft {
  event: string;
  focus: string;
  date: string;
  drills: DrillEntry[];
  sessionRpe: number | null;
  sessionFeeling: string;
  sessionNotes: string;
}

type PRResult = {
  event: string;
  implement: string;
  distance: number;
  previousBest?: number;
};

type WarningResult = { type: string; message: string; severity: string };

/* ─── Main ─────────────────────────────────────────────────────────────── */

export function LogSessionForm({
  userId,
  athleteId,
  apiEndpoint = "/api/athlete/log-session",
  sessionsPath = "/athlete/sessions",
  allowedEvents,
  editSessionId,
}: WizardProps) {
  const router = useRouter();
  const toast = useToast();
  const showResumeToast = useDraftResumeToast();
  const outboxStatus = useOutboxStatus();
  const isEditing = !!editSessionId;
  const [editLoading, setEditLoading] = useState(isEditing);
  const resumeToastFiredRef = useRef(false);

  const filteredEvents = useMemo(
    () => (allowedEvents?.length ? EVENTS.filter((e) => allowedEvents.includes(e.value)) : EVENTS),
    [allowedEvents]
  );

  // ── Form state — persisted to IDB so a tab kill mid-fill doesn't lose
  //    everything. Persistence is disabled when (a) no userId (coach-on-behalf
  //    callers) or (b) editing an existing session — there's nothing to
  //    "resume" because the row is already on the server.
  const draftKey = userId && !isEditing ? `${userId}:log-session:new` : null;
  const initialDraft = useMemo<LogSessionDraft>(
    () => ({
      event: filteredEvents.length === 1 ? filteredEvents[0].value : "",
      focus: "",
      date: localToday(),
      drills: [],
      sessionRpe: null,
      sessionFeeling: "",
      sessionNotes: "",
    }),
    [filteredEvents]
  );
  const [draft, setDraft, draftStatus] = useDraftPersistence<LogSessionDraft>(
    draftKey,
    initialDraft
  );

  // Stable per-attempt id for server-side idempotency. One value across the
  // direct submit and any outbox replay for the same attempt; a fresh attempt
  // after Discard or after a successful save gets a new key.
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // Backwards-compatible named accessors so the existing JSX (~600 lines
  // below) stays untouched. Each setter wraps `setDraft` to update the
  // corresponding field; supports both value-form and updater-form callers.
  const { event, focus, date, drills, sessionRpe, sessionFeeling, sessionNotes } = draft;
  const setEvent = useCallback(
    (next: string) => setDraft((d) => ({ ...d, event: next })),
    [setDraft]
  );
  const setFocus = useCallback(
    (next: string) => setDraft((d) => ({ ...d, focus: next })),
    [setDraft]
  );
  const setDate = useCallback(
    (next: string) => setDraft((d) => ({ ...d, date: next })),
    [setDraft]
  );
  const setDrills = useCallback(
    (next: DrillEntry[] | ((prev: DrillEntry[]) => DrillEntry[])) =>
      setDraft((d) => ({
        ...d,
        drills: typeof next === "function" ? next(d.drills) : next,
      })),
    [setDraft]
  );
  const setSessionRpe = useCallback(
    (next: number | null) => setDraft((d) => ({ ...d, sessionRpe: next })),
    [setDraft]
  );
  const setSessionFeeling = useCallback(
    (next: string) => setDraft((d) => ({ ...d, sessionFeeling: next })),
    [setDraft]
  );
  const setSessionNotes = useCallback(
    (next: string) => setDraft((d) => ({ ...d, sessionNotes: next })),
    [setDraft]
  );

  const [pastDrills, setPastDrills] = useState<string[]>([]);
  const [showAllDrills, setShowAllDrills] = useState<Record<string, boolean>>({});

  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [responsePRs, setResponsePRs] = useState<PRResult[]>([]);
  const [prCelebration, setPrCelebration] = useState<{
    show: boolean;
    event?: string;
    distance?: number;
  }>({ show: false });
  const [responseWarnings, setResponseWarnings] = useState<WarningResult[]>([]);
  const [doneSummary, setDoneSummary] = useState<null | {
    eventLabel: string;
    drillCount: number;
    throwCount: number;
    sessionBest: number | null;
  }>(null);

  // ── Load existing session for edit mode ────────────────────────────
  useEffect(() => {
    if (!editSessionId) return;
    setEditLoading(true);
    fetch(`${apiEndpoint}/${editSessionId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.success || !data.data) {
          throw new Error(data.error || `Failed to load session (${r.status})`);
        }
        const s = data.data;
        setEvent(s.event || "");
        setDate(s.date || localToday());
        setFocus(s.focus || "");
        setSessionNotes(s.notes || "");
        setSessionRpe(s.sessionRpe ?? null);
        setSessionFeeling(s.sessionFeeling || "");
        if (s.drillLogs?.length) {
          setDrills(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            s.drillLogs.map((d: any) => {
              const unit: "meters" | "feet" = d.bestMarkUnit === "feet" ? "feet" : "meters";
              // Prefer the value the user typed (bestMarkOriginal) in their chosen
              // unit. Falls back to the canonical meters value for legacy rows
              // written before bestMarkUnit existed.
              const displayBest =
                d.bestMarkOriginal != null
                  ? String(d.bestMarkOriginal)
                  : d.bestMark != null
                    ? String(d.bestMark)
                    : "";
              return {
                id: d.id || crypto.randomUUID(),
                drillType: d.drillType || "",
                implementId: d.implementId ?? null,
                implementWeight:
                  d.implementWeightOriginal != null
                    ? String(d.implementWeightOriginal)
                    : d.implementWeight != null
                      ? String(d.implementWeight)
                      : "",
                implementUnit: (d.implementWeightUnit === "lbs" ? "lbs" : "kg") as "kg" | "lbs",
                wireLength: d.wireLength || "FULL",
                throwCount: d.throwCount != null ? String(d.throwCount) : "",
                bestMark: displayBest,
                distanceUnit: unit,
                notes: d.notes || "",
              };
            })
          );
        }
      })
      .catch((err) => {
        logger.error("log-session edit load failed", {
          context: "athlete/log-session/log-session-wizard",
          error: err,
        });
        toast.error(
          err instanceof Error ? err.message : "Couldn't load session — refresh and try again"
        );
      })
      .finally(() => setEditLoading(false));
  }, [
    editSessionId,
    apiEndpoint,
    toast,
    setEvent,
    setDate,
    setFocus,
    setSessionNotes,
    setSessionRpe,
    setSessionFeeling,
    setDrills,
  ]);

  // ── Past drill suggestions ─────────────────────────────────────────
  useEffect(() => {
    if (!event) {
      setPastDrills([]);
      return;
    }
    fetch(`/api/throws/past-drills?event=${event}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPastDrills(d.data);
      })
      .catch((err) => {
        // Non-fatal — past-drill suggestions are a nice-to-have.
        logger.error("past-drills fetch failed", {
          context: "athlete/log-session/log-session-wizard",
          error: err,
        });
      });
  }, [event]);

  // ── Drill mutators ─────────────────────────────────────────────────
  function addDrill() {
    setDrills((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        drillType: DEFAULT_DRILL_BY_EVENT[event] || "",
        implementId: null,
        implementWeight: "",
        implementUnit: "kg",
        wireLength: "FULL",
        throwCount: "",
        bestMark: "",
        // Inherit the previous drill's unit — athletes typically stay in one
        // unit per session. First drill defaults to meters.
        distanceUnit: prev[prev.length - 1]?.distanceUnit ?? "meters",
        notes: "",
      },
    ]);
  }

  function updateDrill<F extends keyof DrillEntry>(id: string, field: F, value: DrillEntry[F]) {
    setDrills((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }

  function removeDrill(id: string) {
    setDrills((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Validation & save gating ───────────────────────────────────────
  const hasValidDrill = drills.some((d) => d.drillType);
  const canSave = !!event && hasValidDrill && !submitting;

  // ── Resume toast for a recovered draft ───────────────────────────────
  // One-shot per page load. Skips edit mode (no draft persistence there) and
  // skips drafts with no user content (e.g. just the default localToday()).
  const { hasDraft, lastSavedAt, clearDraft } = draftStatus;
  useEffect(() => {
    if (resumeToastFiredRef.current) return;
    if (!hasDraft || !lastSavedAt) return;
    const startedFilling =
      drills.length > 0 ||
      sessionNotes.trim() !== "" ||
      sessionFeeling !== "" ||
      focus.trim() !== "" ||
      sessionRpe !== null;
    if (!startedFilling) return;

    resumeToastFiredRef.current = true;
    showResumeToast({
      lastSavedAt,
      noun: "session",
      onDiscard: async () => {
        await clearDraft();
        setDraft(initialDraft);
      },
    });
  }, [
    hasDraft,
    lastSavedAt,
    clearDraft,
    drills,
    sessionNotes,
    sessionFeeling,
    focus,
    sessionRpe,
    showResumeToast,
    setDraft,
    initialDraft,
  ]);

  // ── Build the request body once — used by both direct submit and outbox.
  const buildRequestBody = useCallback(
    () => ({
      event,
      date,
      // Wizard-owned fields are always sent. Null means "cleared" — under
      // the PUT handler's merge semantics, explicit null writes null.
      // Omitted fields are left alone; these four fields are never omitted.
      focus: focus || null,
      notes: sessionNotes.trim() || null,
      sessionRpe,
      sessionFeeling: sessionFeeling || null,
      drills: drills
        .filter((d) => d.drillType)
        .map((d) => {
          const rawBest = parseNumericField(d.bestMark);
          // Canonical bestMark is always meters — convert at the boundary.
          // Preserve rawBest as bestMarkOriginal so edit mode can round-trip
          // the athlete's typed value without lossy mm→ft→mm conversion.
          const best = rawBest != null && d.distanceUnit === "feet" ? rawBest * 0.3048 : rawBest;
          const rawImpl = parseNumericField(d.implementWeight);
          const implWeight =
            rawImpl != null && d.implementUnit === "lbs" ? rawImpl * LBS_TO_KG : rawImpl;
          return {
            drillType: d.drillType,
            implementId: d.implementId,
            implementWeight: implWeight,
            implementWeightUnit: d.implementUnit,
            implementWeightOriginal: rawImpl,
            wireLength: event === "HAMMER" ? d.wireLength : undefined,
            throwCount: parseIntField(d.throwCount) ?? 0,
            bestMark: best,
            bestMarkUnit: d.distanceUnit,
            bestMarkOriginal: rawBest,
            notes: d.notes.trim() || undefined,
          };
        }),
    }),
    [event, date, focus, sessionNotes, sessionRpe, sessionFeeling, drills]
  );

  // ── Submit ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSave) return;
    setSubmitting(true);
    const body = buildRequestBody();
    const url = isEditing ? `${apiEndpoint}/${editSessionId}` : apiEndpoint;
    const method = isEditing ? "PUT" : "POST";

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current,
          ...csrfHeaders(),
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      // Network failure — queue for replay. New sessions only; PUTs (edit
      // mode) skip the outbox because the server returns the latest authority
      // anyway, and a stale PUT replay risks overwriting newer edits.
      if (isEditing) {
        toast.error("Couldn't save your changes — check your connection and try again.");
        setSubmitting(false);
        return;
      }
      logger.warn("log-session: network failure, enqueuing to outbox", {
        context: "athlete/log-session/wizard",
        metadata: {
          err: networkErr instanceof Error ? networkErr.message : String(networkErr),
        },
      });
      try {
        await enqueueMutation({
          url,
          method,
          bodyJson: body,
          idempotencyKey: idempotencyKeyRef.current,
          metadata: { kind: "log-session", event },
        });
        toast.warning("Saved locally", "Will sync to your coach when you're back online.");
        await clearDraft();
        setDraft(initialDraft);
        setQueued(true);
      } catch (queueErr) {
        logger.error("log-session: enqueue failed", {
          context: "athlete/log-session/wizard",
          error: queueErr,
        });
        toast.error("Couldn't save session — try again with a connection.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const data = await res.json();
      if (!res.ok || !data.success) {
        reportApiError({ res, payload: data }, toast, { onRetry: handleSubmit });
        return;
      }

      track("session_saved", {
        sessionType: "throws",
        isEdit: isEditing,
        throwCount: drills.reduce((sum, d) => sum + (parseIntField(d.throwCount) ?? 0), 0),
      });

      // PWA install-prompt engagement signal — only on new sessions.
      if (!isEditing) bumpLogsSubmitted();

      if (data.prs?.length) {
        const prs = data.prs as PRResult[];
        setResponsePRs(prs);

        // Headline PR drives the full-screen overlay + haptic. The toast
        // fan-out below still fires for each PR so the athlete sees every
        // one — but only the biggest gets the cinematic treatment.
        const headlinePr = prs.reduce<PRResult | null>(
          (best, p) => (best == null || p.distance > best.distance ? p : best),
          null
        );
        if (headlinePr) {
          haptic.pr();
          setPrCelebration({
            show: true,
            event: headlinePr.event,
            distance: headlinePr.distance,
          });
        }

        for (const pr of prs) {
          const eventLabel = formatEventType(pr.event);
          const description =
            pr.previousBest != null
              ? `${pr.implement || eventLabel} · +${(pr.distance - pr.previousBest).toFixed(2)}m over your previous best`
              : `${pr.implement || eventLabel} · First-ever PR`;
          toast.celebration("New Personal Best!", {
            highlight: `${pr.distance.toFixed(2)}m`,
            description,
          });
          track("pr_celebrated", {
            event: event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN",
            distanceM: Number(pr.distance) || 0,
            isCompetition: false,
          });
        }
      } else {
        // No PR — but the save still succeeded. Match the "PR path"
        // 2-channel feedback (haptic + toast) so a successful save never
        // feels mute, per CLAUDE.md §Save buttons need two feedback
        // channels.
        haptic.success();
        toast.success(isEditing ? "Session updated" : "Session saved");
      }
      if (data.warnings?.length) setResponseWarnings(data.warnings);

      // Goal milestone celebrations — fan out a celebration toast for each
      // crossing (25/50/75) and let the goal completion (100) be its own
      // moment. We don't show a full overlay here because the PR overlay
      // already owns the screen if the throw was a PR; goals will fire
      // their full overlay on next visit to /athlete/goals.
      if (Array.isArray(data.goalCelebrations) && data.goalCelebrations.length > 0) {
        const { fireGoalCelebrations } = await import("@/lib/goals/celebrate-client");
        fireGoalCelebrations(data.goalCelebrations as MilestoneCelebration[], toast);
      }

      // Server has the row — drop the persisted draft so a second tab or a
      // future visit doesn't surface a "resume" toast for an already-saved
      // session.
      await clearDraft();

      // Compute the summary BEFORE showing the done screen — once shown,
      // drills/event aren't needed anymore but the summary needs them.
      const throwCount = drills.reduce((s, d) => s + (parseIntField(d.throwCount) ?? 0), 0);
      // Convert each drill to meters using its own unit, then take the max.
      const bestDistancesMeters = drills
        .map((d) => {
          const raw = parseNumericField(d.bestMark);
          if (raw == null || raw <= 0) return null;
          return d.distanceUnit === "feet" ? raw * 0.3048 : raw;
        })
        .filter((n): n is number => n != null);
      const sessionBest = bestDistancesMeters.length > 0 ? Math.max(...bestDistancesMeters) : null;
      setDoneSummary({
        eventLabel: EVENTS.find((e) => e.value === event)?.label ?? event,
        drillCount: drills.filter((d) => d.drillType).length,
        throwCount,
        sessionBest,
      });
    } catch (err) {
      logger.error("log-session: response handling failed", {
        context: "athlete/log-session/wizard",
        error: err,
      });
      reportApiError({ err }, toast, { onRetry: handleSubmit });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading state for edit mode ────────────────────────────────────
  if (editLoading) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-4">
        <div className="w-10 h-10 mx-auto border-[3px] border-[var(--color-border-default)] border-t-[var(--color-brand)] rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading session…</p>
      </div>
    );
  }

  // ── Queued state (network failure, payload in outbox) ───────────────
  if (queued) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
          <WifiOff size={28} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold font-heading text-[var(--color-text-primary)]">
            Saved locally
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mx-auto">
            Your session will sync to your coach as soon as you&rsquo;re back online.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={sessionsPath}
            className="text-sm font-semibold text-[var(--color-brand)] hover:opacity-80 transition-opacity"
          >
            View sessions
          </Link>
          <span className="text-[var(--color-border-strong)]">·</span>
          <button
            type="button"
            onClick={() => {
              setQueued(false);
              // Fresh attempt = fresh idempotency key.
              idempotencyKeyRef.current =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }}
            className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Log another
          </button>
        </div>
      </div>
    );
  }

  // ── Done state ─────────────────────────────────────────────────────
  if (doneSummary) {
    return (
      <>
        <DoneScreen
          isEditing={isEditing}
          summary={doneSummary}
          prs={responsePRs}
          warnings={responseWarnings}
          sessionsPath={sessionsPath}
          onLogAnother={() => {
            // Reset to the wizard's initial draft AND clear the IDB row so
            // the new attempt doesn't surface a "resume" toast for stale data.
            setDraft(initialDraft);
            void clearDraft();
            // Fresh attempt = fresh idempotency key.
            idempotencyKeyRef.current =
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setResponsePRs([]);
            setResponseWarnings([]);
            setDoneSummary(null);
            setPrCelebration({ show: false });
          }}
        />
        <PRCelebration
          show={prCelebration.show}
          onDismiss={() => setPrCelebration({ show: false })}
          event={prCelebration.event}
          distance={prCelebration.distance}
        />
      </>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pb-28">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => router.push(sessionsPath)}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors min-h-[44px] -ml-1.5 px-1.5"
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          Cancel
        </button>
        <h1 className="font-heading text-base font-semibold text-[var(--color-text-primary)]">
          {isEditing ? "Edit session" : "Log session"}
        </h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-[128px] text-xs"
          aria-label="Session date"
        />
      </header>

      {/* Save-status row — quiet by design; only visible when saving, offline,
          or with outbox-pending items. Hides itself when state is "Saved". */}
      {(submitting || !outboxStatus.isOnline || outboxStatus.pending > 0) && (
        <div className="flex justify-end mb-3">
          <SaveStatusChip
            isSaving={submitting}
            pending={outboxStatus.pending}
            isOnline={outboxStatus.isOnline}
            authNeeded={outboxStatus.authNeeded}
          />
        </div>
      )}

      {/* Sections — one scrollable form, no wizard */}
      <div className="space-y-7">
        <Section title="Event">
          <div className="grid grid-cols-2 gap-2">
            {filteredEvents.map((ev) => {
              const selected = event === ev.value;
              return (
                <button
                  key={ev.value}
                  type="button"
                  onClick={() => setEvent(ev.value)}
                  aria-pressed={selected}
                  className={
                    "flex items-center gap-2.5 px-4 rounded-xl border text-left transition-colors min-h-[56px] " +
                    (selected
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-text-primary)]"
                      : "border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]")
                  }
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ev.color }}
                    aria-hidden="true"
                  />
                  <span className="font-heading text-sm font-semibold">{ev.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Focus" optional>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => {
              const selected = focus === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFocus(selected ? "" : f)}
                  aria-pressed={selected}
                  className={
                    "px-3.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] " +
                    (selected
                      ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-strong)]"
                      : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
                  }
                >
                  {f}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={`Drills${drills.length > 0 ? ` · ${drills.length}` : ""}`}>
          <div className="space-y-3">
            {drills.map((drill, idx) => (
              <DrillCard
                key={drill.id}
                drill={drill}
                index={idx + 1}
                event={event}
                athleteId={athleteId}
                pastDrills={pastDrills}
                showAll={!!showAllDrills[drill.id]}
                onToggleShowAll={() =>
                  setShowAllDrills((prev) => ({ ...prev, [drill.id]: !prev[drill.id] }))
                }
                onUpdate={(field, value) => updateDrill(drill.id, field, value)}
                onRemove={() => removeDrill(drill.id)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addDrill}
            disabled={!event}
            className="mt-3 w-full flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl border-2 border-dashed border-[var(--color-border-default)] text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-strong)] hover:border-[var(--color-brand)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            {drills.length === 0 ? "Add your first drill" : "Add another drill"}
          </button>
        </Section>

        <Section title="How did it feel?" optional>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {FEELING_OPTIONS.map((f) => {
              const selected = sessionFeeling === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSessionFeeling(selected ? "" : f.value)}
                  aria-pressed={selected}
                  className={
                    "py-2.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] " +
                    (selected
                      ? "bg-[var(--color-brand-subtle)] text-[var(--color-text-primary)]"
                      : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
                  }
                  style={selected ? { boxShadow: `inset 0 0 0 1.5px ${f.tone}` } : undefined}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                Session RPE
              </span>
              <span className="text-micro text-[var(--color-text-secondary)] tabular-nums">
                {sessionRpe != null ? `${sessionRpe} / 10` : "—"}
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const selected = sessionRpe === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSessionRpe(selected ? null : n)}
                    aria-pressed={selected}
                    className={
                      "min-h-[44px] rounded-md text-xs font-semibold transition-colors tabular-nums " +
                      (selected
                        ? "bg-[var(--color-brand)] text-[var(--color-text-on-brand)]"
                        : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
                    }
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Notes" optional>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            className="input w-full min-h-[72px] resize-y"
            placeholder="Anything worth remembering about today — timing, weather, cues that clicked…"
          />
        </Section>
      </div>

      {/* Sticky save bar — always visible, enabled when valid. Drops to the
          viewport bottom because the AthleteShell hides the BottomTabBar
          on focus-mode routes (including log-session). */}
      <div
        className="fixed left-0 right-0 z-20 px-4 py-3 bg-[var(--surface-overlay)] border-t border-[var(--color-border-default)]"
        style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-lg mx-auto">
          {/* Mobile: slide to confirm — lower commitment threshold for a save
              that may trigger PR celebrations and immutable throws logs. */}
          <div className="sm:hidden">
            <SlideToConfirm
              label={
                submitting ? "Saving…" : isEditing ? "Slide to update" : "Slide to save session"
              }
              onConfirm={handleSubmit}
              disabled={!canSave}
            />
          </div>
          {/* Desktop: plain primary button */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <Link
              href={sessionsPath}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="btn-primary min-w-[180px]"
            >
              {submitting ? "Saving…" : isEditing ? "Update session" : "Save session"}
            </button>
          </div>
          {!canSave && !submitting && (
            <p className="mt-2 text-center text-micro text-[var(--color-text-secondary)] sm:hidden">
              {!event
                ? "Pick an event to get started"
                : !hasValidDrill
                  ? "Add at least one drill"
                  : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Section primitive ──────────────────────────────────────────────── */

function Section({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {title}
        </h2>
        {optional && (
          <span className="text-nano text-[var(--color-text-secondary)] opacity-60">optional</span>
        )}
      </div>
      {children}
    </section>
  );
}

/* ─── Drill Card ─────────────────────────────────────────────────────── */

function DrillCard({
  drill,
  index,
  event,
  athleteId,
  pastDrills,
  showAll,
  onToggleShowAll,
  onUpdate,
  onRemove,
}: {
  drill: DrillEntry;
  index: number;
  event: string;
  athleteId?: string;
  pastDrills: string[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onUpdate: <F extends keyof DrillEntry>(field: F, value: DrillEntry[F]) => void;
  onRemove: () => void;
}) {
  const eventDrills = DRILLS_BY_EVENT[event] || [];
  const showPastChips = pastDrills.length > 0 && !showAll;
  const [pickerOpen, setPickerOpen] = useState(false);
  // Pre-narrow the picker to the current event when one is selected.
  const pickerThrowType: ImplementType | undefined =
    event === "SHOT_PUT"
      ? "SHOT"
      : event === "HAMMER" || event === "DISCUS" || event === "JAVELIN"
        ? event
        : event === "WEIGHT_THROW"
          ? "WEIGHT_THROW"
          : undefined;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          Drill {index}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove drill ${index}`}
          className="p-1.5 -m-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-status-danger-fg)] transition-colors"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Drill type */}
      <div>
        {showPastChips ? (
          <div className="flex flex-wrap gap-2">
            {pastDrills.map((dt) => {
              const selected = drill.drillType === dt;
              return (
                <button
                  key={dt}
                  type="button"
                  onClick={() => onUpdate("drillType", dt)}
                  className={
                    "px-3 py-2 min-h-[44px] text-xs font-semibold rounded-lg transition-colors " +
                    (selected
                      ? "bg-[var(--color-brand)] text-[var(--color-text-on-brand)]"
                      : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
                  }
                >
                  {dt}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onToggleShowAll}
              className="px-3 py-2 min-h-[44px] text-xs font-semibold rounded-lg border border-dashed border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand-strong)] hover:border-[var(--color-brand)] transition-colors"
            >
              More…
            </button>
          </div>
        ) : (
          <select
            value={drill.drillType}
            onChange={(e) => onUpdate("drillType", e.target.value)}
            className="input w-full"
            aria-label="Drill type"
          >
            <option value="">Select a drill…</option>
            {eventDrills.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Throws + weight row */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label">Throws</label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={drill.throwCount}
            onChange={(e) => onUpdate("throwCount", e.target.value)}
            placeholder="10"
          />
        </div>
        <div>
          <label className="label">Weight</label>
          <div className="flex items-stretch gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={drill.implementWeight}
              onChange={(e) => onUpdate("implementWeight", e.target.value)}
              placeholder="7.26"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onUpdate("implementUnit", drill.implementUnit === "kg" ? "lbs" : "kg")}
              aria-label={`Toggle unit, currently ${drill.implementUnit}`}
              className="shrink-0 min-w-[44px] px-2 text-xs font-bold rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand-strong)] hover:border-[var(--color-brand)] transition-colors"
            >
              {drill.implementUnit}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label="Pick implement from catalog"
              className="shrink-0 min-w-[44px] px-2 text-xs font-bold rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand-strong)] hover:border-[var(--color-brand)] transition-colors"
            >
              Pick
            </button>
          </div>
        </div>
      </div>

      {/* Wire length — hammer only */}
      {event === "HAMMER" && (
        <div>
          <label className="label">Wire</label>
          <div className="flex flex-wrap gap-2">
            {WIRE_LENGTH_OPTIONS.map((wl) => {
              const selected = drill.wireLength === wl.value;
              return (
                <button
                  key={wl.value}
                  type="button"
                  onClick={() => onUpdate("wireLength", wl.value)}
                  className={
                    "px-3 py-2 min-h-[44px] text-micro font-bold rounded-lg transition-colors " +
                    (selected
                      ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-strong)]"
                      : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
                  }
                >
                  {wl.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Best mark + notes */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Best</label>
            <div
              role="radiogroup"
              aria-label="Distance unit"
              className="flex rounded-md overflow-hidden border border-[var(--color-border-default)]"
            >
              {(["meters", "feet"] as const).map((unit) => {
                const selected = drill.distanceUnit === unit;
                return (
                  <button
                    key={unit}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onUpdate("distanceUnit", unit)}
                    className={
                      "px-2 py-1 text-nano font-medium tracking-wide transition-colors " +
                      (selected
                        ? "bg-[var(--color-brand)] text-[var(--color-text-on-brand)]"
                        : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
                    }
                  >
                    {unit === "meters" ? "m" : "ft"}
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={drill.bestMark}
            onChange={(e) => onUpdate("bestMark", e.target.value)}
            placeholder={drill.distanceUnit === "meters" ? "18.50" : "60.70"}
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <Input
            type="text"
            value={drill.notes}
            onChange={(e) => onUpdate("notes", e.target.value)}
            placeholder="Timing felt off…"
          />
        </div>
      </div>

      <ImplementPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        athleteId={athleteId ?? null}
        side="bottom"
        throwType={pickerThrowType}
        title="Pick implement"
        // Drill log surface — show WEIGHT_THROW customs (tires, plates) too.
        // Server-side throws-log filtering doesn't apply here.
        mode="drills"
        onSelect={(row: ImplementCatalogRow) => {
          // Persist catalog id so the server can resolve custom implements
          // (3/4 wire variants, plates, tires) without weight-based fuzzy
          // matching that can't disambiguate variants of the same weight.
          onUpdate("implementId", row.id);
          // Catalog primaryUnit drives the form's unit toggle. Decimal
          // weight value comes from the canonical kg/lb on the catalog row.
          // Note: discus 600 g shows as 0.6 kg here — DrillEntry's
          // unit type is "kg" | "lbs" only; gram-typed implements stay
          // in kg internally.
          if (row.primaryUnit === "lb") {
            onUpdate("implementUnit", "lbs");
            onUpdate("implementWeight", String(row.weightLb));
          } else {
            onUpdate("implementUnit", "kg");
            onUpdate("implementWeight", String(row.weightKg));
          }
        }}
      />
    </div>
  );
}

/* ─── Done Screen ────────────────────────────────────────────────────── */

function DoneScreen({
  isEditing,
  summary,
  prs,
  warnings,
  sessionsPath,
  onLogAnother,
}: {
  isEditing: boolean;
  summary: {
    eventLabel: string;
    drillCount: number;
    throwCount: number;
    sessionBest: number | null;
  };
  prs: PRResult[];
  warnings: WarningResult[];
  sessionsPath: string;
  onLogAnother: () => void;
}) {
  const router = useRouter();
  return (
    <div className="max-w-lg mx-auto text-center space-y-6 pt-8 pb-12">
      <div
        className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--color-status-success-bg)" }}
      >
        <CheckCircle2
          size={28}
          strokeWidth={1.75}
          style={{ color: "var(--color-status-success-fg)" }}
          aria-hidden="true"
        />
      </div>

      <div>
        <h2 className="font-heading text-2xl font-semibold text-[var(--color-text-primary)]">
          {isEditing ? "Session updated." : "Session logged."}
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
          {summary.eventLabel} · {summary.drillCount}{" "}
          {summary.drillCount === 1 ? "drill" : "drills"} ·{" "}
          <span className="tabular-nums">
            <NumberFlow value={summary.throwCount} />
          </span>{" "}
          throws
          {summary.sessionBest != null && (
            <>
              {" "}
              · best{" "}
              <span className="tabular-nums">
                <NumberFlow value={summary.sessionBest} decimals={2} suffix="m" />
              </span>
            </>
          )}
        </p>
      </div>

      {prs.length > 0 && (
        <ul className="space-y-2 w-full max-w-sm mx-auto">
          {prs.map((pr, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left"
              style={{
                backgroundColor: "var(--color-brand-subtle)",
                borderColor: "var(--color-brand)",
              }}
            >
              <Trophy
                size={18}
                strokeWidth={1.75}
                style={{ color: "var(--color-brand-strong)" }}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-brand-strong)" }}>
                  New PR ·{" "}
                  <span className="tabular-nums">
                    <NumberFlow value={pr.distance} decimals={2} suffix="m" />
                  </span>
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {pr.implement}
                  {pr.previousBest != null && <> · was {pr.previousBest.toFixed(2)}m</>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-2 w-full max-w-sm mx-auto">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="flex gap-2 px-4 py-3 rounded-xl border text-left"
              style={{
                backgroundColor: "var(--color-status-warning-bg)",
                borderColor: "var(--color-status-warning-fg)",
              }}
            >
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--color-status-warning-fg)" }}
              />
              <p
                className="text-xs leading-snug"
                style={{ color: "var(--color-status-warning-fg)" }}
              >
                {w.message}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-3 justify-center pt-2">
        <button type="button" onClick={() => router.push(sessionsPath)} className="btn-secondary">
          View sessions
        </button>
        <button type="button" onClick={onLogAnother} className="btn-primary">
          Log another
        </button>
      </div>
    </div>
  );
}
