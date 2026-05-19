"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/user-avatar";
import { csrfHeaders } from "@/lib/csrf-client";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { type EventCode, type GenderCode } from "@/lib/throws/constants";
import {
  DEFICIT_TYPE_LABELS,
  DEFICIT_LEVEL_COLORS,
  DEFICIT_LEVEL_BG,
  type DeficitType,
  type DeficitLevel,
} from "@/lib/throws/podium-profile";
import { EVENT_LABELS, EVENT_COLORS, TestingBadge, type ThrowsProfileRow } from "./throws-shared";
import { useThrowsEnrollmentData } from "./useThrowsEnrollmentData";

import { logger } from "@/lib/logger";
const EVENT_CODES: EventCode[] = ["SP", "DT", "HT", "JT"];
const EVENT_TYPE_TO_CODE: Record<string, EventCode> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};
const GENDER_TYPE_TO_CODE: Record<string, GenderCode> = { MALE: "M", FEMALE: "F" };

interface EnrollForm {
  athleteId: string;
  events: EventCode[];
  gender: GenderCode | "";
  competitionPb: string;
}

const EMPTY_FORM: EnrollForm = { athleteId: "", events: [], gender: "", competitionPb: "" };

export function ThrowsView({ teamId }: { teamId: string | null }) {
  const router = useRouter();
  const { podiumAthletes, allAthletes, rosterAthletes, loading, refetch } =
    useThrowsEnrollmentData(teamId);

  const [activeTab, setActiveTab] = useState<"podium" | "all">("podium");

  // Enrollment form state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState<EnrollForm>(EMPTY_FORM);
  const [enrollDistUnit, setEnrollDistUnit] = useState<"meters" | "feet">("meters");
  const [autoImported, setAutoImported] = useState(false);
  const [autoImportedPrCount, setAutoImportedPrCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Removal state
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  // Invite-link copy state
  const [inviteCopied, setInviteCopied] = useState<string | null>(null);

  const enrolledAthleteIds = new Set(podiumAthletes.map((p) => p.athleteId));
  const unenrolledAthletes = allAthletes.filter((a) => !enrolledAthleteIds.has(a.id));

  const eventCounts = podiumAthletes.reduce<Record<string, number>>((acc, p) => {
    acc[p.event] = (acc[p.event] ?? 0) + 1;
    return acc;
  }, {});

  function handleEnrollAthleteChange(athleteId: string) {
    const roster = rosterAthletes.find((r) => r.id === athleteId);
    if (roster && roster.user?.claimedAt) {
      const mappedEvents = roster.events
        .map((e) => EVENT_TYPE_TO_CODE[e])
        .filter((e): e is EventCode => !!e);
      const mappedGender = GENDER_TYPE_TO_CODE[roster.gender] ?? "";
      const bestPr = roster.throwsPRs?.sort((a, b) => b.distance - a.distance)?.[0];
      const prCount = roster.throwsPRs?.length ?? 0;
      setEnrollForm({
        athleteId,
        events: mappedEvents,
        gender: mappedGender,
        competitionPb: bestPr ? String(bestPr.distance) : "",
      });
      setAutoImported(true);
      setAutoImportedPrCount(prCount);
      if (bestPr) setEnrollDistUnit("meters");
    } else {
      setEnrollForm((f) => ({ ...f, athleteId, events: [], gender: "", competitionPb: "" }));
      setAutoImported(false);
      setAutoImportedPrCount(0);
    }
  }

  function toggleEnrollEvent(ev: EventCode) {
    setEnrollForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  }

  function closeEnroll() {
    setEnrollOpen(false);
    setEnrollForm(EMPTY_FORM);
    setAutoImported(false);
    setAutoImportedPrCount(0);
    setSaveError("");
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollForm.athleteId || enrollForm.events.length === 0 || !enrollForm.gender) return;

    // Pre-validate competitionPb so we never POST NaN to the API.
    let competitionPbMeters: number | undefined;
    if (enrollForm.competitionPb) {
      const parsed = parseFloat(enrollForm.competitionPb);
      if (!Number.isFinite(parsed)) {
        setSaveError("Competition PB must be a number.");
        return;
      }
      competitionPbMeters = enrollDistUnit === "feet" ? parsed * 0.3048 : parsed;
    }

    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/throws/podium-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          athleteId: enrollForm.athleteId,
          events: enrollForm.events,
          gender: enrollForm.gender,
          competitionPb: competitionPbMeters,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        closeEnroll();
        refetch();
      } else {
        setSaveError(data.error || "Enrollment failed");
      }
    } catch {
      setSaveError("Enrollment failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(athleteId: string) {
    setRemovingId(athleteId);
    setRemoveError("");
    try {
      const res = await fetch(`/api/throws/podium-roster/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "inactive" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to remove athlete");
      }
      refetch();
    } catch (err) {
      setRemoveError(
        err instanceof Error ? err.message : "Failed to remove athlete. Please try again."
      );
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }

  async function handleInvite(athleteId: string) {
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mode: "link", athleteProfileId: athleteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const link = `${window.location.origin}/athletes/claim/${data.data.token}`;
      await navigator.clipboard.writeText(link);
      setInviteCopied(athleteId);
      setTimeout(() => setInviteCopied(null), 3000);
    } catch (err) {
      logger.error("Failed to create invite:", {
        context: "coach/athletes/_views/throws-view",
        error: err,
      });
    }
  }

  if (loading) {
    return (
      <div className="animate-spring-up space-y-4">
        <div className="skeleton h-16 rounded-2xl" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtitle + secondary link */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Manage Podium Throws enrollments and view deficit profiles.
        </p>
        <Link
          href="/coach/throws"
          className="text-sm text-primary-600 dark:text-primary-300 hover:underline font-medium"
        >
          Throws Hub →
        </Link>
      </div>

      {/* Stats Strip */}
      <div className="space-y-3">
        <div className="card !p-3 text-center">
          <p className="text-2xl font-bold text-[var(--foreground)]">{podiumAthletes.length}</p>
          <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">Athletes Enrolled</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {EVENT_CODES.map((code) => (
            <div key={code} className="card !p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: EVENT_COLORS[code] }}>
                {eventCounts[code] ?? 0}
              </p>
              <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">
                {EVENT_LABELS[code]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs: Podium / All */}
      <div className="flex items-center gap-1 bg-[var(--muted-bg)] rounded-xl p-1 w-fit">
        {[
          { id: "podium" as const, label: "Podium Throws" },
          { id: "all" as const, label: "All Athletes" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-surface-700 dark:text-surface-300 hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
            {tab.id === "podium" && podiumAthletes.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[rgba(212,168,67,0.12)] text-primary-600 dark:text-primary-300 text-nano font-bold">
                {podiumAthletes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "podium" && (
        <PodiumTab
          podiumAthletes={podiumAthletes}
          unenrolledAthletes={unenrolledAthletes}
          rosterAthletes={rosterAthletes}
          allAthletesEmpty={allAthletes.length === 0}
          removeError={removeError}
          enrollOpen={enrollOpen}
          setEnrollOpen={setEnrollOpen}
          enrollForm={enrollForm}
          setEnrollForm={setEnrollForm}
          enrollDistUnit={enrollDistUnit}
          setEnrollDistUnit={setEnrollDistUnit}
          autoImported={autoImported}
          autoImportedPrCount={autoImportedPrCount}
          saving={saving}
          saveError={saveError}
          onEnrollSubmit={handleEnroll}
          onEnrollClose={closeEnroll}
          onEnrollAthleteChange={handleEnrollAthleteChange}
          onToggleEvent={toggleEnrollEvent}
          removingId={removingId}
          confirmRemoveId={confirmRemoveId}
          onAskRemove={setConfirmRemoveId}
          onRemove={handleRemove}
          onNavigateProfile={(athleteId) => router.push(`/coach/athletes/${athleteId}`)}
        />
      )}

      {activeTab === "all" && (
        <AllTab
          allAthletes={allAthletes}
          podiumAthletes={podiumAthletes}
          rosterAthletes={rosterAthletes}
          enrolledAthleteIds={enrolledAthleteIds}
          inviteCopied={inviteCopied}
          onInvite={handleInvite}
          onEnrollClick={(athleteId) => {
            handleEnrollAthleteChange(athleteId);
            setActiveTab("podium");
            setEnrollOpen(true);
          }}
          onNavigateAthlete={(athleteId) => router.push(`/coach/athletes/${athleteId}`)}
        />
      )}
    </div>
  );
}

// ── Podium sub-tab ────────────────────────────────────────────────

interface PodiumTabProps {
  podiumAthletes: ThrowsProfileRow[];
  unenrolledAthletes: { id: string; user: { firstName: string; lastName: string } }[];
  rosterAthletes: ReturnType<typeof useThrowsEnrollmentData>["rosterAthletes"];
  allAthletesEmpty: boolean;
  removeError: string;
  enrollOpen: boolean;
  setEnrollOpen: (v: boolean) => void;
  enrollForm: EnrollForm;
  setEnrollForm: React.Dispatch<React.SetStateAction<EnrollForm>>;
  enrollDistUnit: "meters" | "feet";
  setEnrollDistUnit: (v: "meters" | "feet") => void;
  autoImported: boolean;
  autoImportedPrCount: number;
  saving: boolean;
  saveError: string;
  onEnrollSubmit: (e: React.FormEvent) => void;
  onEnrollClose: () => void;
  onEnrollAthleteChange: (athleteId: string) => void;
  onToggleEvent: (ev: EventCode) => void;
  removingId: string | null;
  confirmRemoveId: string | null;
  onAskRemove: (id: string | null) => void;
  onRemove: (id: string) => void;
  onNavigateProfile: (athleteId: string) => void;
}

function PodiumTab(p: PodiumTabProps) {
  return (
    <div className="space-y-4">
      {p.removeError && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 rounded-xl text-sm">
          {p.removeError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-700 dark:text-surface-300">
          {p.podiumAthletes.length === 0
            ? "No athletes enrolled yet"
            : `${p.podiumAthletes.length} athlete${p.podiumAthletes.length !== 1 ? "s" : ""} in Podium Throws`}
        </p>
        {p.unenrolledAthletes.length > 0 && !p.enrollOpen && (
          <button
            type="button"
            onClick={() => p.setEnrollOpen(true)}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add to Podium Throws
          </button>
        )}
      </div>

      {p.enrollOpen && (
        <EnrollmentPanel
          unenrolledAthletes={p.unenrolledAthletes}
          rosterAthletes={p.rosterAthletes}
          enrollForm={p.enrollForm}
          setEnrollForm={p.setEnrollForm}
          enrollDistUnit={p.enrollDistUnit}
          setEnrollDistUnit={p.setEnrollDistUnit}
          autoImported={p.autoImported}
          autoImportedPrCount={p.autoImportedPrCount}
          saving={p.saving}
          saveError={p.saveError}
          onSubmit={p.onEnrollSubmit}
          onClose={p.onEnrollClose}
          onAthleteChange={p.onEnrollAthleteChange}
          onToggleEvent={p.onToggleEvent}
        />
      )}

      {p.podiumAthletes.length === 0 && !p.enrollOpen && (
        <div className="card text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(212,168,67,0.08)] flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6 text-primary-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)] text-sm">
              No athletes in Podium Throws
            </p>
            <p className="text-xs text-muted mt-1">
              Enroll athletes to unlock Bondarchuk deficit analysis and KPI profiling.
            </p>
          </div>
          {p.unenrolledAthletes.length > 0 && (
            <button
              type="button"
              onClick={() => p.setEnrollOpen(true)}
              className="btn-primary text-sm px-4 py-2 mx-auto"
            >
              Add First Athlete
            </button>
          )}
          {p.unenrolledAthletes.length === 0 && p.allAthletesEmpty && (
            <Link
              href="/coach/athletes/invitations"
              className="btn-primary text-sm px-4 py-2 inline-block"
            >
              Invite Athletes
            </Link>
          )}
        </div>
      )}

      {p.podiumAthletes.length > 0 && (
        <StaggeredList className="space-y-3">
          {p.podiumAthletes.map((profile) => (
            <PodiumAthleteCard
              key={profile.id}
              profile={profile}
              isRemoving={p.removingId === profile.athleteId}
              isConfirming={p.confirmRemoveId === profile.athleteId}
              onAskRemove={() => p.onAskRemove(profile.athleteId)}
              onCancelRemove={() => p.onAskRemove(null)}
              onConfirmRemove={() => p.onRemove(profile.athleteId)}
              onNavigate={() => p.onNavigateProfile(profile.athleteId)}
            />
          ))}
        </StaggeredList>
      )}
    </div>
  );
}

function PodiumAthleteCard({
  profile,
  isRemoving,
  isConfirming,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
  onNavigate,
}: {
  profile: ThrowsProfileRow;
  isRemoving: boolean;
  isConfirming: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onNavigate: () => void;
}) {
  const eventCode = profile.event as EventCode;
  const eventColor = EVENT_COLORS[eventCode] ?? "#d4a843";
  const eventLabel = EVENT_LABELS[eventCode] ?? profile.event;
  const deficitType = profile.deficitPrimary as DeficitType | null;
  const deficitLevel = profile.deficitStatus as DeficitLevel | null;

  return (
    <div
      className="card card-interactive !p-4 flex items-center gap-3"
      role="link"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter") onNavigate();
      }}
    >
      <UserAvatar
        src={profile.athlete.profilePictureUrl}
        firstName={profile.athlete.user.firstName}
        lastName={profile.athlete.user.lastName}
        size="md"
      />

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-[var(--foreground)] text-sm">
            {profile.athlete.user.firstName} {profile.athlete.user.lastName}
          </p>
          <span
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-micro font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: eventColor }}
          >
            {eventLabel}
            <span className="opacity-80">{profile.gender === "M" ? "♂" : "♀"}</span>
          </span>
          {profile.competitionPb && (
            <span className="text-micro font-mono text-surface-700 dark:text-surface-300 flex-shrink-0">
              {profile.competitionPb.toFixed(2)}m
              {profile.currentDistanceBand && (
                <span className="font-sans ml-1 text-muted">
                  Band {profile.currentDistanceBand}m
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {deficitLevel && deficitType && deficitType !== "none" ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-nano font-medium flex-shrink-0 ${DEFICIT_LEVEL_COLORS[deficitLevel]} ${DEFICIT_LEVEL_BG[deficitLevel]}`}
            >
              {DEFICIT_TYPE_LABELS[deficitType]}
            </span>
          ) : (
            <span className="text-nano text-muted flex-shrink-0">
              {profile.competitionPb ? "Awaiting test data" : "No PB entered"}
            </span>
          )}
          <TestingBadge records={profile.testingRecords ?? []} />
        </div>
      </div>

      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {isConfirming ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-surface-700 dark:text-surface-300 whitespace-nowrap">
              Remove?
            </span>
            <button
              type="button"
              onClick={onConfirmRemove}
              disabled={isRemoving}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-60 whitespace-nowrap"
            >
              {isRemoving ? "…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={onCancelRemove}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskRemove}
            className="text-xs px-2.5 py-1.5 rounded-lg text-muted hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
            title="Remove from Podium Throws"
            aria-label={`Remove ${profile.athlete.user.firstName} ${profile.athlete.user.lastName} from Podium Throws`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z M18 12v6m-3-3h6"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Enrollment panel ──────────────────────────────────────────────

interface EnrollmentPanelProps {
  unenrolledAthletes: { id: string; user: { firstName: string; lastName: string } }[];
  rosterAthletes: ReturnType<typeof useThrowsEnrollmentData>["rosterAthletes"];
  enrollForm: EnrollForm;
  setEnrollForm: React.Dispatch<React.SetStateAction<EnrollForm>>;
  enrollDistUnit: "meters" | "feet";
  setEnrollDistUnit: (v: "meters" | "feet") => void;
  autoImported: boolean;
  autoImportedPrCount: number;
  saving: boolean;
  saveError: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onAthleteChange: (athleteId: string) => void;
  onToggleEvent: (ev: EventCode) => void;
}

function EnrollmentPanel(p: EnrollmentPanelProps) {
  const rosterMatch = p.rosterAthletes.find((r) => r.id === p.enrollForm.athleteId);
  return (
    <div className="card !p-5 border-2 border-[rgba(212,168,67,0.2)] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--foreground)] text-sm">
          Enroll Athlete in Podium Throws
        </h3>
        <button
          type="button"
          onClick={p.onClose}
          className="p-1 text-muted hover:text-surface-700 dark:hover:text-surface-300 rounded-lg"
          aria-label="Close enrollment form"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form onSubmit={p.onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
            Athlete
          </label>
          <select
            value={p.enrollForm.athleteId}
            onChange={(e) => p.onAthleteChange(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
          >
            <option value="">Select athlete…</option>
            {p.unenrolledAthletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.user.firstName} {a.user.lastName}
              </option>
            ))}
          </select>
          {p.autoImported && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-nano font-semibold bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-400">
                <svg
                  className="w-2.5 h-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Auto-imported
              </span>
              {p.autoImportedPrCount > 0 && (
                <span className="text-nano text-success-600 dark:text-success-400">
                  {p.autoImportedPrCount} mark{p.autoImportedPrCount !== 1 ? "s" : ""} found
                </span>
              )}
              {rosterMatch && rosterMatch.events?.length > 0 && (
                <span className="text-nano text-surface-700 dark:text-surface-300">
                  {rosterMatch.events.length} event{rosterMatch.events.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
            Events
          </label>
          <div className="flex flex-wrap gap-2">
            {EVENT_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => p.onToggleEvent(code)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  p.enrollForm.events.includes(code)
                    ? "bg-[rgba(212,168,67,0.15)] text-primary-600 dark:text-primary-300"
                    : "bg-[var(--muted-bg)] text-muted hover:text-surface-700 dark:hover:text-surface-300"
                }`}
              >
                {EVENT_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
            Gender
          </label>
          <select
            value={p.enrollForm.gender}
            onChange={(e) =>
              p.setEnrollForm((f) => ({ ...f, gender: e.target.value as GenderCode }))
            }
            required
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
          >
            <option value="">Select…</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-surface-700 dark:text-surface-300">
              Competition PB <span className="text-muted font-normal">(optional)</span>
            </label>
            <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
              {(["meters", "feet"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => p.setEnrollDistUnit(unit)}
                  className={`px-2.5 py-0.5 text-nano font-medium transition-colors ${
                    p.enrollDistUnit === unit
                      ? "bg-primary-500 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {unit === "meters" ? "m" : "ft"}
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={p.enrollDistUnit === "meters" ? "e.g. 18.45" : "e.g. 60.53"}
            value={p.enrollForm.competitionPb}
            onChange={(e) => p.setEnrollForm((f) => ({ ...f, competitionPb: e.target.value }))}
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
          />
        </div>

        {p.saveError && (
          <p className="text-xs text-danger-600 dark:text-danger-400">{p.saveError}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={p.onClose} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={p.saving}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-60"
          >
            {p.saving ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enrolling…
              </>
            ) : (
              "Enroll Athlete"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── All Athletes sub-tab ──────────────────────────────────────────

interface AllTabProps {
  allAthletes: ReturnType<typeof useThrowsEnrollmentData>["allAthletes"];
  podiumAthletes: ThrowsProfileRow[];
  rosterAthletes: ReturnType<typeof useThrowsEnrollmentData>["rosterAthletes"];
  enrolledAthleteIds: Set<string>;
  inviteCopied: string | null;
  onInvite: (athleteId: string) => void;
  onEnrollClick: (athleteId: string) => void;
  onNavigateAthlete: (athleteId: string) => void;
}

function AllTab(p: AllTabProps) {
  if (p.allAthletes.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-muted">No athletes on your roster yet.</p>
        <Link
          href="/coach/athletes/invitations"
          className="btn-primary text-sm px-4 py-2 mt-3 inline-block"
        >
          Invite Athlete
        </Link>
      </div>
    );
  }

  return (
    <StaggeredList className="space-y-3">
      {p.allAthletes.map((athlete) => {
        const enrolled = p.enrolledAthleteIds.has(athlete.id);
        const profileRow = p.podiumAthletes.find((pr) => pr.athleteId === athlete.id);
        const rosterMatch = p.rosterAthletes.find((r) => r.id === athlete.id);
        const isClaimed = rosterMatch?.user?.claimedAt != null;
        return (
          <div
            key={athlete.id}
            className="card card-interactive !p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap"
            role="link"
            tabIndex={0}
            onClick={() => p.onNavigateAthlete(athlete.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") p.onNavigateAthlete(athlete.id);
            }}
          >
            <UserAvatar
              src={athlete.profilePictureUrl}
              firstName={athlete.user.firstName}
              lastName={athlete.user.lastName}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--foreground)] text-sm">
                  {athlete.user.firstName} {athlete.user.lastName}
                </p>
                {!isClaimed && rosterMatch && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-nano font-semibold bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 flex-shrink-0">
                    Not yet claimed
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                {isClaimed || !rosterMatch ? athlete.user.email : "Pending invite"}
              </p>
            </div>

            {enrolled && profileRow ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-semibold text-white flex-shrink-0"
                style={{
                  backgroundColor: EVENT_COLORS[profileRow.event as EventCode] ?? "#d4a843",
                }}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Podium {EVENT_LABELS[profileRow.event as EventCode]}
              </span>
            ) : (
              <span className="text-micro text-muted flex-shrink-0">Not enrolled</span>
            )}

            <div
              className="flex gap-2 flex-shrink-0 ml-auto sm:ml-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {!isClaimed && rosterMatch && (
                <button
                  type="button"
                  onClick={() => p.onInvite(athlete.id)}
                  className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap flex items-center gap-1"
                >
                  {p.inviteCopied === athlete.id ? (
                    <>
                      <svg
                        className="w-3 h-3 text-success-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      Invite
                    </>
                  )}
                </button>
              )}
              <Link
                href={`/coach/athletes/${athlete.id}`}
                className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
              >
                Open profile
              </Link>
              {!enrolled && (
                <button
                  type="button"
                  onClick={() => p.onEnrollClick(athlete.id)}
                  className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                >
                  Enroll
                </button>
              )}
            </div>
          </div>
        );
      })}
    </StaggeredList>
  );
}
