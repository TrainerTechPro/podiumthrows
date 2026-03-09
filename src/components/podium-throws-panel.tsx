"use client";

/**
 * PodiumThrowsPanel
 *
 * Self-contained coach-facing panel for Bondarchuk Podium Throws profiling.
 * Fetches its own data from /api/throws/podium-roster/[athleteId] and
 * /api/throws/podium-roster/[athleteId]/testing.
 *
 * Shows:
 *   - Enrollment status + event + distance band
 *   - Primary / secondary deficit classification
 *   - Implement ratio analysis (heavy + light vs KPI targets)
 *   - Strength-to-bodyweight snapshot
 *   - Testing record log
 *   - Inline "Record Test" form
 */

import { useState, useCallback, useEffect } from "react";
import {
  DEFICIT_TYPE_LABELS,
  DEFICIT_LEVEL_LABELS,
  DEFICIT_LEVEL_COLORS,
  DEFICIT_LEVEL_BG,
  DEFICIT_TRAINING_RECS,
  type DeficitType,
  type DeficitLevel,
} from "@/lib/throws/podium-profile";
import { EVENT_COLORS, RATIO_STATUS_COLORS, FALLBACK_GRAY } from "@/lib/design-tokens";

// ── Types ─────────────────────────────────────────────────────────────────

interface ThrowsProfileData {
  id: string;
  athleteId: string;
  event: string;
  gender: string;
  status: string;
  competitionPb: number | null;
  currentDistanceBand: string | null;
  heavyImplementPr: number | null;
  heavyImplementKg: number | null;
  lightImplementPr: number | null;
  lightImplementKg: number | null;
  strengthBenchmarks: string | null;
  deficitPrimary: string | null;
  deficitSecondary: string | null;
  deficitStatus: string | null;
  overPowered: boolean;
  adaptationProfile: number | null;
  sessionsToForm: number | null;
  recommendedMethod: string | null;
  coachNotes: string | null;
  enrolledAt: string;
}

interface TestingRecord {
  id: string;
  testDate: string;
  testType: string;
  competitionMark: number | null;
  heavyImplMark: number | null;
  heavyImplKg: number | null;
  lightImplMark: number | null;
  lightImplKg: number | null;
  squatKg: number | null;
  benchKg: number | null;
  snatchKg: number | null;
  cleanKg: number | null;
  bodyWeightKg: number | null;
  deficitPrimaryAtTest: string | null;
  distanceBandAtTest: string | null;
  notes: string | null;
}

interface StrengthBenchmarks {
  squatKg?: number | null;
  benchKg?: number | null;
  cleanKg?: number | null;
  snatchKg?: number | null;
  ohpKg?: number | null;
  bodyWeightKg?: number | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  SP: "Shot Put",
  DT: "Discus",
  HT: "Hammer",
  JT: "Javelin",
};

// EVENT_COLORS imported from @/lib/design-tokens

// ── Ratio Bar ──────────────────────────────────────────────────────────────

function RatioBar({
  label,
  ratio,
  status,
  pr,
  pb,
  kg,
}: {
  label: string;
  ratio: number | null;
  status: DeficitLevel | null;
  pr: number | null;
  pb: number | null;
  kg: number | null;
}) {
  const pct = ratio != null ? Math.min(ratio * 100, 130) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400 font-medium">
          {label}
        </span>
        <span className="text-gray-500 dark:text-gray-500">
          {pr != null ? (
            <>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {pr.toFixed(2)}m
              </span>
              {kg != null && (
                <span className="ml-1 text-gray-400">({kg}kg)</span>
              )}
              {pb != null && ratio != null && (
                <span
                  className={`ml-2 font-semibold ${
                    status ? DEFICIT_LEVEL_COLORS[status] : ""
                  }`}
                >
                  {(ratio * 100).toFixed(0)}%
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400 italic">not recorded</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        {pct != null && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: status
                ? RATIO_STATUS_COLORS[status] ?? RATIO_STATUS_COLORS.far
                : FALLBACK_GRAY,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Strength Row ───────────────────────────────────────────────────────────

function StrengthRow({
  label,
  kg,
  bwKg,
}: {
  label: string;
  kg: number | null | undefined;
  bwKg: number | null | undefined;
}) {
  const ratio = kg && bwKg && bwKg > 0 ? kg / bwKg : null;

  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-800 dark:text-gray-200">
        {kg != null ? (
          <>
            {kg}kg
            {ratio != null && (
              <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                ({ratio.toFixed(2)}× BW)
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400 italic">—</span>
        )}
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PodiumThrowsPanel({
  athleteId,
}: {
  athleteId: string;
}) {
  const [profile, setProfile] = useState<ThrowsProfileData | null>(null);
  const [records, setRecords] = useState<TestingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEnrolled, setNotEnrolled] = useState(false);

  // UI state
  const [showTestForm, setShowTestForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRec, setShowRec] = useState(false);

  // Test form
  const [testForm, setTestForm] = useState({
    testDate: new Date().toISOString().slice(0, 10),
    competitionMark: "",
    heavyImplMark: "",
    heavyImplKg: "",
    lightImplMark: "",
    lightImplKg: "",
    squatKg: "",
    benchKg: "",
    cleanKg: "",
    snatchKg: "",
    bodyWeightKg: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(() => {
    if (!athleteId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/throws/podium-roster/${athleteId}`).then((r) => r.json()),
      fetch(`/api/throws/podium-roster/${athleteId}/testing`).then((r) =>
        r.json()
      ),
    ])
      .then(([profileData, recordsData]) => {
        if (profileData.success) {
          setProfile(profileData.data);
          setNotEnrolled(false);
        } else if (profileData.error?.includes("not enrolled")) {
          setNotEnrolled(true);
        }
        if (recordsData.success) setRecords(recordsData.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [athleteId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Submit test ────────────────────────────────────────────────────

  async function handleSubmitTest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        testDate: testForm.testDate,
        ...(testForm.competitionMark
          ? { competitionMark: parseFloat(testForm.competitionMark) }
          : {}),
        ...(testForm.heavyImplMark
          ? { heavyImplMark: parseFloat(testForm.heavyImplMark) }
          : {}),
        ...(testForm.heavyImplKg
          ? { heavyImplKg: parseFloat(testForm.heavyImplKg) }
          : {}),
        ...(testForm.lightImplMark
          ? { lightImplMark: parseFloat(testForm.lightImplMark) }
          : {}),
        ...(testForm.lightImplKg
          ? { lightImplKg: parseFloat(testForm.lightImplKg) }
          : {}),
        ...(testForm.squatKg
          ? { squatKg: parseFloat(testForm.squatKg) }
          : {}),
        ...(testForm.benchKg
          ? { benchKg: parseFloat(testForm.benchKg) }
          : {}),
        ...(testForm.cleanKg
          ? { cleanKg: parseFloat(testForm.cleanKg) }
          : {}),
        ...(testForm.snatchKg
          ? { snatchKg: parseFloat(testForm.snatchKg) }
          : {}),
        ...(testForm.bodyWeightKg
          ? { bodyWeightKg: parseFloat(testForm.bodyWeightKg) }
          : {}),
        ...(testForm.notes ? { notes: testForm.notes } : {}),
      };

      const res = await fetch(
        `/api/throws/podium-roster/${athleteId}/testing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (data.success) {
        setShowTestForm(false);
        setTestForm({
          testDate: new Date().toISOString().slice(0, 10),
          competitionMark: "",
          heavyImplMark: "",
          heavyImplKg: "",
          lightImplMark: "",
          lightImplKg: "",
          squatKg: "",
          benchKg: "",
          cleanKg: "",
          snatchKg: "",
          bodyWeightKg: "",
          notes: "",
        });
        fetchAll();
      } else {
        setSaveError(data.error || "Failed to save test");
      }
    } catch {
      setSaveError("Failed to save test");
    } finally {
      setSaving(false);
    }
  }

  // ── Not enrolled ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="card !p-5 space-y-3 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    );
  }

  if (notEnrolled || !profile) {
    return (
      <div className="card !p-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Podium Throws
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Athlete is not enrolled in Podium Throws.{" "}
              <a
                href="/coach/throws/roster"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Enroll from Roster →
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const eventCode = profile.event;
  const eventColor = EVENT_COLORS[eventCode] ?? "#d4a843";
  const eventLabel = EVENT_LABELS[eventCode] ?? eventCode;
  const deficitType = profile.deficitPrimary as DeficitType | null;
  const deficitSecondary = profile.deficitSecondary as DeficitType | null;
  const deficitLevel = profile.deficitStatus as DeficitLevel | null;

  const benchmarks: StrengthBenchmarks = profile.strengthBenchmarks
    ? JSON.parse(profile.strengthBenchmarks)
    : {};

  // Implement ratios
  const heavyRatio =
    profile.heavyImplementPr != null && profile.competitionPb
      ? profile.heavyImplementPr / profile.competitionPb
      : null;
  const lightRatio =
    profile.lightImplementPr != null && profile.competitionPb
      ? profile.lightImplementPr / profile.competitionPb
      : null;

  const hasDeficitData = deficitType && deficitType !== "none";
  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-950 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder-gray-400 dark:placeholder-gray-600";

  return (
    <div className="card !p-0 overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${eventColor}20` }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: eventColor }}
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
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Podium Throws
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: eventColor }}
              >
                {eventLabel} {profile.gender === "M" ? "♂" : "♀"}
              </span>
              {profile.currentDistanceBand && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  Band {profile.currentDistanceBand}m
                </span>
              )}
              {profile.competitionPb && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  · PB {profile.competitionPb.toFixed(2)}m
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setShowTestForm((v) => !v);
            setSaveError("");
          }}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          Record Test
        </button>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Record Test Form ─────────────────────────────────────── */}
        {showTestForm && (
          <div className="rounded-2xl border-2 border-primary-200 dark:border-primary-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                Testing Battery
              </p>
              <button
                onClick={() => setShowTestForm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitTest} className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Test Date
                </label>
                <input
                  type="date"
                  value={testForm.testDate}
                  onChange={(e) =>
                    setTestForm((f) => ({ ...f, testDate: e.target.value }))
                  }
                  required
                  className={inputCls}
                />
              </div>

              {/* Implement marks */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Implement Marks (meters)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                      Comp PB (optional update)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={profile.competitionPb?.toFixed(2) ?? "—"}
                      value={testForm.competitionMark}
                      onChange={(e) =>
                        setTestForm((f) => ({
                          ...f,
                          competitionMark: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div />
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                      Heavy impl mark
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 17.20"
                      value={testForm.heavyImplMark}
                      onChange={(e) =>
                        setTestForm((f) => ({
                          ...f,
                          heavyImplMark: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                      Heavy impl weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      placeholder="e.g. 7.26"
                      value={testForm.heavyImplKg}
                      onChange={(e) =>
                        setTestForm((f) => ({
                          ...f,
                          heavyImplKg: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                      Light impl mark
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 20.10"
                      value={testForm.lightImplMark}
                      onChange={(e) =>
                        setTestForm((f) => ({
                          ...f,
                          lightImplMark: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                      Light impl weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      placeholder="e.g. 5.0"
                      value={testForm.lightImplKg}
                      onChange={(e) =>
                        setTestForm((f) => ({
                          ...f,
                          lightImplKg: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Strength */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Strength (kg)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "bodyWeightKg", label: "Body weight" },
                    { key: "squatKg", label: "Back squat" },
                    { key: "benchKg", label: "Bench press" },
                    { key: "cleanKg", label: "Power clean" },
                    { key: "snatchKg", label: "Snatch" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="kg"
                        value={testForm[key as keyof typeof testForm]}
                        onChange={(e) =>
                          setTestForm((f) => ({
                            ...f,
                            [key]: e.target.value,
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Conditions, observations…"
                  value={testForm.notes}
                  onChange={(e) =>
                    setTestForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className={`${inputCls} resize-none`}
                />
              </div>

              {saveError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTestForm(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Test"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Deficit Summary ──────────────────────────────────────── */}
        {hasDeficitData && deficitLevel ? (
          <div
            className={`rounded-2xl p-4 ${DEFICIT_LEVEL_BG[deficitLevel]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-sm font-bold ${DEFICIT_LEVEL_COLORS[deficitLevel]}`}
                  >
                    {DEFICIT_TYPE_LABELS[deficitType!]}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${DEFICIT_LEVEL_COLORS[deficitLevel]} ${DEFICIT_LEVEL_BG[deficitLevel]} border border-current/20`}
                  >
                    {DEFICIT_LEVEL_LABELS[deficitLevel]}
                  </span>
                  {profile.overPowered && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                      ⚡ Over-powered
                    </span>
                  )}
                </div>
                {deficitSecondary && deficitSecondary !== "none" && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Secondary:{" "}
                    <span className="font-medium">
                      {DEFICIT_TYPE_LABELS[deficitSecondary]}
                    </span>
                  </p>
                )}
              </div>

              <button
                onClick={() => setShowRec((v) => !v)}
                className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline flex-shrink-0"
              >
                {showRec ? "Hide rec" : "Training rec"}
              </button>
            </div>

            {showRec && deficitType && (
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-t border-current/10 pt-3">
                {DEFICIT_TRAINING_RECS[deficitType]}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {!profile.competitionPb
                ? "Enter competition PB to unlock deficit analysis"
                : "Record an implement test to compute deficit analysis"}
            </p>
          </div>
        )}

        {/* ── Implement Ratios ─────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Implement Ratios
          </p>
          <div className="space-y-3">
            <RatioBar
              label="Heavy implement"
              ratio={heavyRatio}
              status={
                heavyRatio != null && deficitLevel
                  ? (profile.deficitPrimary === "heavy_implement"
                      ? deficitLevel
                      : null)
                  : null
              }
              pr={profile.heavyImplementPr}
              pb={profile.competitionPb}
              kg={profile.heavyImplementKg}
            />
            <RatioBar
              label="Light implement"
              ratio={lightRatio}
              status={
                lightRatio != null && deficitLevel
                  ? (profile.deficitPrimary === "light_implement"
                      ? deficitLevel
                      : null)
                  : null
              }
              pr={profile.lightImplementPr}
              pb={profile.competitionPb}
              kg={profile.lightImplementKg}
            />
          </div>
        </div>

        {/* ── Strength Snapshot ────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Strength Snapshot
          </p>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden px-3">
            <StrengthRow
              label="Body weight"
              kg={benchmarks.bodyWeightKg}
              bwKg={null}
            />
            <StrengthRow
              label="Back squat"
              kg={benchmarks.squatKg}
              bwKg={benchmarks.bodyWeightKg}
            />
            <StrengthRow
              label="Bench press"
              kg={benchmarks.benchKg}
              bwKg={benchmarks.bodyWeightKg}
            />
            <StrengthRow
              label="Power clean"
              kg={benchmarks.cleanKg}
              bwKg={benchmarks.bodyWeightKg}
            />
            <StrengthRow
              label="Snatch"
              kg={benchmarks.snatchKg}
              bwKg={benchmarks.bodyWeightKg}
            />
          </div>
        </div>

        {/* ── Testing History ──────────────────────────────────────── */}
        {records.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Test History ({records.length})
              </p>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  showHistory ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {new Date(rec.testDate + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </span>
                      {rec.deficitPrimaryAtTest && rec.deficitPrimaryAtTest !== "none" && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {DEFICIT_TYPE_LABELS[rec.deficitPrimaryAtTest as DeficitType]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 dark:text-gray-400">
                      {rec.competitionMark && (
                        <span>Comp: <b className="text-gray-700 dark:text-gray-300">{rec.competitionMark.toFixed(2)}m</b></span>
                      )}
                      {rec.heavyImplMark && (
                        <span>Heavy: <b className="text-gray-700 dark:text-gray-300">{rec.heavyImplMark.toFixed(2)}m</b></span>
                      )}
                      {rec.lightImplMark && (
                        <span>Light: <b className="text-gray-700 dark:text-gray-300">{rec.lightImplMark.toFixed(2)}m</b></span>
                      )}
                      {rec.squatKg && (
                        <span>Squat: <b className="text-gray-700 dark:text-gray-300">{rec.squatKg}kg</b></span>
                      )}
                      {rec.cleanKg && (
                        <span>Clean: <b className="text-gray-700 dark:text-gray-300">{rec.cleanKg}kg</b></span>
                      )}
                    </div>
                    {rec.notes && (
                      <p className="text-gray-400 dark:text-gray-500 italic">{rec.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Adaptation Info ──────────────────────────────────────── */}
        {(profile.adaptationProfile != null || profile.recommendedMethod) && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Adaptation
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
              {profile.adaptationProfile != null && (
                <span>
                  Group:{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {profile.adaptationProfile}
                  </span>
                </span>
              )}
              {profile.sessionsToForm != null && (
                <span>
                  Sessions to form:{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {profile.sessionsToForm}
                  </span>
                </span>
              )}
              {profile.recommendedMethod && (
                <span>
                  Method:{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {profile.recommendedMethod}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
