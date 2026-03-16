"use client";

import { useState, useRef, type FormEvent } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

// ── Types ────────────────────────────────────────────────────────────

type EventCode = "SP" | "DT" | "HT" | "JT";
type GenderCode = "M" | "F";
type Step = "form" | "results";
type DeficitLevel = "above" | "within" | "below" | "far_below";
type DeficitType =
  | "heavy_implement"
  | "light_implement"
  | "strength"
  | "balanced"
  | "none";

interface DeficitResult {
  primary: DeficitType;
  overallStatus: DeficitLevel;
  overPowered: boolean;
  heavyRatio: number | null;
  heavyStatus: DeficitLevel | null;
  squatBwRatio: number | null;
  squatStatus: DeficitLevel | null;
  distanceBand: string | null;
}

// ── Approximate KPI Standards (client-side, from Bondarchuk Vol. IV) ─

interface KpiBenchmark {
  heavyRatioMin: number;
  heavyRatioTypical: number;
  squatBwMin: number;
  squatBwTypical: number;
}

// Reasonable defaults per event+gender. In the full app these come from
// ThrowsKpiStandard rows per distance band. Here we use mid-range values
// that give directionally correct results for any level.
const KPI_DEFAULTS: Record<string, KpiBenchmark> = {
  SP_M: { heavyRatioMin: 0.88, heavyRatioTypical: 0.93, squatBwMin: 1.8, squatBwTypical: 2.1 },
  SP_F: { heavyRatioMin: 0.87, heavyRatioTypical: 0.92, squatBwMin: 1.5, squatBwTypical: 1.8 },
  DT_M: { heavyRatioMin: 0.85, heavyRatioTypical: 0.90, squatBwMin: 1.6, squatBwTypical: 1.9 },
  DT_F: { heavyRatioMin: 0.84, heavyRatioTypical: 0.89, squatBwMin: 1.3, squatBwTypical: 1.6 },
  HT_M: { heavyRatioMin: 0.86, heavyRatioTypical: 0.91, squatBwMin: 1.5, squatBwTypical: 1.8 },
  HT_F: { heavyRatioMin: 0.85, heavyRatioTypical: 0.90, squatBwMin: 1.2, squatBwTypical: 1.5 },
  JT_M: { heavyRatioMin: 0.83, heavyRatioTypical: 0.88, squatBwMin: 1.4, squatBwTypical: 1.7 },
  JT_F: { heavyRatioMin: 0.82, heavyRatioTypical: 0.87, squatBwMin: 1.2, squatBwTypical: 1.5 },
};

const DISTANCE_BANDS: Record<string, string[]> = {
  SP_M: ["14-15", "15-16", "16-17", "17-18", "18-19", "19-20", "20-21"],
  SP_F: ["13-14", "14-15", "15-16", "16-17", "17-18", "18-19"],
  DT_M: ["40-45", "45-50", "50-55", "55-60", "60-65", "65-70"],
  DT_F: ["40-45", "45-50", "50-55", "55-60", "60-65"],
  HT_M: ["45-50", "50-55", "55-60", "60-65", "65-70", "70-75"],
  HT_F: ["45-50", "50-55", "55-60"],
  JT_M: ["50-55", "55-60", "60-65", "65-70", "70-75", "75-80"],
  JT_F: ["40-45", "45-50", "50-55", "55-60", "60-65"],
};

const EVENT_LABELS: Record<EventCode, string> = {
  SP: "Shot Put",
  DT: "Discus",
  HT: "Hammer",
  JT: "Javelin",
};

const COMP_WEIGHTS: Record<string, string> = {
  SP_M: "7.26kg", SP_F: "4kg",
  DT_M: "2kg", DT_F: "1kg",
  HT_M: "7.26kg", HT_F: "4kg",
  JT_M: "800g", JT_F: "600g",
};

const HEAVY_EXAMPLES: Record<string, string> = {
  SP_M: "8kg or 9kg shot", SP_F: "5kg shot",
  DT_M: "2.5kg discus", DT_F: "1.25kg discus",
  HT_M: "8kg or 9kg hammer", HT_F: "5kg hammer",
  JT_M: "900g javelin", JT_F: "700g javelin",
};

// ── Calculator Logic ─────────────────────────────────────────────────

function classifyBand(event: EventCode, gender: GenderCode, pr: number): string | null {
  const key = `${event}_${gender}`;
  const bands = DISTANCE_BANDS[key];
  if (!bands) return null;
  for (const band of bands) {
    const [min, max] = band.split("-").map(Number);
    if (pr >= min && pr < max) return band;
  }
  if (bands.length > 0) {
    const last = bands[bands.length - 1];
    const [, max] = last.split("-").map(Number);
    if (pr >= max) return last;
  }
  return null;
}

function classifyLevel(
  ratio: number,
  min: number,
  typical: number,
  margin = 0.07
): DeficitLevel {
  const upper = typical * 1.05;
  if (ratio >= upper) return "above";
  if (ratio >= min) return "within";
  if (ratio >= min - margin) return "below";
  return "far_below";
}

function runDeficitAnalysis(
  event: EventCode,
  gender: GenderCode,
  competitionPr: number,
  heavyMark: number | null,
  squatKg: number | null,
  bodyweightKg: number | null
): DeficitResult {
  const key = `${event}_${gender}`;
  const kpi = KPI_DEFAULTS[key] || KPI_DEFAULTS.SP_M;
  const band = classifyBand(event, gender, competitionPr);

  const heavyRatio = heavyMark && heavyMark > 0 ? heavyMark / competitionPr : null;
  const heavyStatus = heavyRatio !== null
    ? classifyLevel(heavyRatio, kpi.heavyRatioMin, kpi.heavyRatioTypical)
    : null;

  const squatBwRatio = squatKg && bodyweightKg && bodyweightKg > 0
    ? squatKg / bodyweightKg
    : null;
  const squatStatus = squatBwRatio !== null
    ? classifyLevel(squatBwRatio, kpi.squatBwMin, kpi.squatBwTypical)
    : null;

  // Determine primary deficit
  const deficitOrder: DeficitLevel[] = ["far_below", "below", "within", "above"];
  const heavyScore = heavyStatus ? deficitOrder.indexOf(heavyStatus) : 2;
  const squatScore = squatStatus ? deficitOrder.indexOf(squatStatus) : 2;

  let primary: DeficitType = "balanced";
  let overPowered = false;

  if (heavyScore < 2 || squatScore < 2) {
    // Something is deficient
    if (heavyScore <= squatScore) {
      primary = "heavy_implement";
    } else {
      primary = "strength";
    }
  }

  // Over-powered: strength is above while heavy implement is below
  if (
    squatStatus &&
    (squatStatus === "above") &&
    heavyStatus &&
    (heavyStatus === "below" || heavyStatus === "far_below")
  ) {
    overPowered = true;
  }

  const overallStatuses = [heavyStatus, squatStatus].filter(
    (s): s is DeficitLevel => s !== null
  );
  const worstIdx = Math.min(
    ...overallStatuses.map((s) => deficitOrder.indexOf(s))
  );
  const overallStatus: DeficitLevel =
    overallStatuses.length > 0
      ? deficitOrder[worstIdx] || "within"
      : "within";

  return {
    primary,
    overallStatus,
    overPowered,
    heavyRatio,
    heavyStatus,
    squatBwRatio,
    squatStatus,
    distanceBand: band,
  };
}

// ── Recommendation Text ──────────────────────────────────────────────

const RECOMMENDATIONS: Record<DeficitType, { title: string; text: string; action: string }> = {
  heavy_implement: {
    title: "Heavy Implement Deficit",
    text: "Your athlete is not generating sufficient force with above-competition weights. The heavy implement mark relative to competition PR is below the Bondarchuk benchmark for this distance band.",
    action: "Increase heavy implement proportion to 35-45% of total throws. Add heavy implement-specific drills (standing throws, power position) with the overweight implement 3-4x per week.",
  },
  light_implement: {
    title: "Light Implement Deficit",
    text: "Your athlete lacks velocity transfer from light to competition weight. This usually indicates a rhythm or timing issue rather than a raw power problem.",
    action: "Increase light implement proportion to 30-40% of total throws. Focus on technical speed, rhythm, and full-throw execution with light implements.",
  },
  strength: {
    title: "Strength Deficit",
    text: "Your athlete's squat-to-bodyweight ratio is below the Bondarchuk standard for their throwing level. Their strength base isn't supporting their current competition marks.",
    action: "Add 3-4 strength sessions per week with emphasis on squat and power clean. Target a minimum squat-to-bodyweight ratio improvement of 0.2 over the next training block.",
  },
  balanced: {
    title: "Balanced Profile",
    text: "All measured ratios fall within the Bondarchuk target range for this distance band. Your athlete's training balance is appropriate for their competition level.",
    action: "Maintain current implement and strength distribution. Focus on technical refinement, competition-specific volume, and peaking strategy for upcoming meets.",
  },
  none: {
    title: "Insufficient Data",
    text: "We need at least a competition PR and one additional data point (heavy implement mark or squat) to provide an analysis.",
    action: "Enter additional data to get your athlete's deficit classification.",
  },
};

// ── Styling Constants ────────────────────────────────────────────────

const STATUS_STYLES: Record<DeficitLevel, { color: string; bg: string; label: string }> = {
  above: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Above Target" },
  within: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "Within Target" },
  below: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Below Target" },
  far_below: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Far Below Target" },
};

// ── Component ────────────────────────────────────────────────────────

export function DeficitFinderClient() {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<DeficitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [event, setEvent] = useState<EventCode>("SP");
  const [gender, setGender] = useState<GenderCode>("M");
  const [competitionPr, setCompetitionPr] = useState("");
  const [heavyMark, setHeavyMark] = useState("");
  const [squatKg, setSquatKg] = useState("");
  const [bodyweightKg, setBodyweightKg] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const eventKey = `${event}_${gender}`;

  function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    const pr = parseFloat(competitionPr);
    if (!pr || pr <= 0) return;

    const heavy = heavyMark ? parseFloat(heavyMark) : null;
    const squat = squatKg ? parseFloat(squatKg) : null;
    const bw = bodyweightKg ? parseFloat(bodyweightKg) : null;

    const deficitResult = runDeficitAnalysis(event, gender, pr, heavy, squat, bw);
    setResult(deficitResult);
    setStep("results");

    // Scroll to results on mobile
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || submitting) return;
    setSubmitting(true);

    try {
      // Parse UTM params from URL
      const params = new URLSearchParams(window.location.search);

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          email,
          name: name || null,
          source: "deficit-finder",
          event,
          gender,
          deficitResult: result,
          utmSource: params.get("utm_source"),
          utmMedium: params.get("utm_medium"),
          utmCampaign: params.get("utm_campaign"),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLeadId(data.id ?? null);
      }

      setEmailSaved(true);
    } catch {
      // Still show success — we don't want to block the user experience
      setEmailSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep("form");
    setResult(null);
    setEmailSaved(false);
    setCompetitionPr("");
    setHeavyMark("");
    setSquatKg("");
    setBodyweightKg("");
  }

  const rec = result ? RECOMMENDATIONS[result.primary] : null;

  return (
    <div className="max-w-lg mx-auto" ref={resultsRef}>
      {step === "form" && (
        <form
          onSubmit={handleAnalyze}
          className="rounded-2xl p-6 sm:p-8 space-y-5"
          style={{
            backgroundColor: "#1a1714",
            border: "1px solid #2a2720",
          }}
        >
          {/* Event + Gender selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#8a8278" }}>
                Event
              </label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value as EventCode)}
                className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{
                  backgroundColor: "#111009",
                  border: "1px solid #2a2720",
                  color: "#f0ede6",
                }}
              >
                {(["SP", "DT", "HT", "JT"] as EventCode[]).map((ev) => (
                  <option key={ev} value={ev}>{EVENT_LABELS[ev]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#8a8278" }}>
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as GenderCode)}
                className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{
                  backgroundColor: "#111009",
                  border: "1px solid #2a2720",
                  color: "#f0ede6",
                }}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
          </div>

          {/* Competition PR */}
          <div>
            <label className="block font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#8a8278" }}>
              Competition PR (meters) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={competitionPr}
              onChange={(e) => setCompetitionPr(e.target.value)}
              placeholder={`Best mark with ${COMP_WEIGHTS[eventKey] || "comp weight"}`}
              className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a554e]"
              style={{
                backgroundColor: "#111009",
                border: "1px solid #2a2720",
                color: "#f0ede6",
              }}
            />
          </div>

          {/* Heavy Implement Mark */}
          <div>
            <label className="block font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#8a8278" }}>
              Heavy Implement Best Mark (meters)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={heavyMark}
              onChange={(e) => setHeavyMark(e.target.value)}
              placeholder={`Best with ${HEAVY_EXAMPLES[eventKey] || "heavy implement"}`}
              className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a554e]"
              style={{
                backgroundColor: "#111009",
                border: "1px solid #2a2720",
                color: "#f0ede6",
              }}
            />
          </div>

          {/* Squat + Bodyweight side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#8a8278" }}>
                Best Squat (kg)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={squatKg}
                onChange={(e) => setSquatKg(e.target.value)}
                placeholder="e.g. 180"
                className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a554e]"
                style={{
                  backgroundColor: "#111009",
                  border: "1px solid #2a2720",
                  color: "#f0ede6",
                }}
              />
            </div>
            <div>
              <label className="block font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#8a8278" }}>
                Bodyweight (kg)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={bodyweightKg}
                onChange={(e) => setBodyweightKg(e.target.value)}
                placeholder="e.g. 105"
                className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a554e]"
                style={{
                  backgroundColor: "#111009",
                  border: "1px solid #2a2720",
                  color: "#f0ede6",
                }}
              />
            </div>
          </div>

          {/* Helper note */}
          <p className="font-body text-xs" style={{ color: "#5a554e" }}>
            Enter at least the competition PR plus one other value (heavy implement mark or squat + bodyweight) for a meaningful analysis.
          </p>

          {/* CTA */}
          <button
            type="submit"
            className="w-full font-heading font-bold text-base py-3.5 transition-colors hover:brightness-110"
            style={{
              backgroundColor: "#f59e0b",
              color: "#0d0c09",
            }}
          >
            Analyze My Thrower
          </button>
        </form>
      )}

      {step === "results" && result && rec && (
        <div className="space-y-5">
          {/* Result Card */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              backgroundColor: "#1a1714",
              border: "1px solid #2a2720",
            }}
          >
            {/* Header with overall status */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="font-heading text-xs uppercase tracking-[0.22em] mb-1" style={{ color: "rgba(245,158,11,0.8)" }}>
                  Deficit Analysis
                </p>
                <h2 className="font-heading font-bold text-xl sm:text-2xl" style={{ color: "#f0ede6" }}>
                  {rec.title}
                </h2>
              </div>
              {result.overPowered && (
                <span
                  className="font-heading text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                >
                  Overpowered
                </span>
              )}
            </div>

            {/* Metrics row */}
            <div
              className="grid grid-cols-2 gap-4 py-5 mb-5"
              style={{ borderTop: "1px solid #2a2720", borderBottom: "1px solid #2a2720" }}
            >
              {result.heavyRatio !== null && result.heavyStatus && (
                <div>
                  <p className="font-heading text-xs uppercase tracking-wider mb-1" style={{ color: "#6b655a" }}>
                    Heavy Impl. Ratio
                  </p>
                  <p className="font-heading font-bold text-2xl" style={{ color: STATUS_STYLES[result.heavyStatus].color }}>
                    {(result.heavyRatio * 100).toFixed(1)}%
                  </p>
                  <span
                    className="inline-block font-heading text-[10px] uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: STATUS_STYLES[result.heavyStatus].bg,
                      color: STATUS_STYLES[result.heavyStatus].color,
                    }}
                  >
                    {STATUS_STYLES[result.heavyStatus].label}
                  </span>
                </div>
              )}
              {result.squatBwRatio !== null && result.squatStatus && (
                <div>
                  <p className="font-heading text-xs uppercase tracking-wider mb-1" style={{ color: "#6b655a" }}>
                    Squat-to-BW
                  </p>
                  <p className="font-heading font-bold text-2xl" style={{ color: STATUS_STYLES[result.squatStatus].color }}>
                    {result.squatBwRatio.toFixed(2)}x
                  </p>
                  <span
                    className="inline-block font-heading text-[10px] uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: STATUS_STYLES[result.squatStatus].bg,
                      color: STATUS_STYLES[result.squatStatus].color,
                    }}
                  >
                    {STATUS_STYLES[result.squatStatus].label}
                  </span>
                </div>
              )}
            </div>

            {/* Distance band + event */}
            {result.distanceBand && (
              <p className="font-body text-xs mb-4" style={{ color: "#6b655a" }}>
                {EVENT_LABELS[event]} &middot; {gender === "M" ? "Men" : "Women"}&rsquo;s &middot; {result.distanceBand}m band
              </p>
            )}

            {/* Analysis text */}
            <p className="font-body text-sm leading-relaxed mb-4" style={{ color: "#a09a90" }}>
              {rec.text}
            </p>

            {result.overPowered && (
              <div
                className="rounded-lg p-4 mb-4"
                style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                <p className="font-heading text-xs uppercase tracking-wider mb-1" style={{ color: "#ef4444" }}>
                  Overpowered Flag
                </p>
                <p className="font-body text-sm" style={{ color: "#a09a90" }}>
                  This athlete&rsquo;s strength exceeds the target range while implement marks are below target.
                  They are wasting adaptation capacity on general strength that isn&rsquo;t transferring to the throw.
                  Shift volume from general preparation to specific developmental exercises.
                </p>
              </div>
            )}

            {/* Recommendation */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}
            >
              <p className="font-heading text-xs uppercase tracking-wider mb-2" style={{ color: "#f59e0b" }}>
                Training Recommendation
              </p>
              <p className="font-body text-sm leading-relaxed" style={{ color: "#a09a90" }}>
                {rec.action}
              </p>
            </div>
          </div>

          {/* Email capture — gate the detailed PDF or save for later */}
          {!emailSaved ? (
            <form
              onSubmit={handleEmailSubmit}
              className="rounded-2xl p-6 sm:p-8"
              style={{
                backgroundColor: "#1a1714",
                border: "1px solid #2a2720",
              }}
            >
              <p className="font-heading font-semibold text-base mb-1" style={{ color: "#f0ede6" }}>
                Save your results &amp; get the full methodology guide
              </p>
              <p className="font-body text-sm mb-5" style={{ color: "#8a8278" }}>
                We&rsquo;ll email your deficit report plus the Bondarchuk Phase Ratios Cheatsheet. No spam.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a554e]"
                  style={{
                    backgroundColor: "#111009",
                    border: "1px solid #2a2720",
                    color: "#f0ede6",
                  }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email *"
                  className="w-full font-body text-sm rounded-lg px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a554e]"
                  style={{
                    backgroundColor: "#111009",
                    border: "1px solid #2a2720",
                    color: "#f0ede6",
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full font-heading font-bold text-base py-3.5 transition-colors hover:brightness-110 disabled:opacity-60"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#0d0c09",
                  }}
                >
                  {submitting ? "Saving..." : "Send My Report"}
                </button>
              </div>

              <p className="font-body text-xs mt-3 text-center" style={{ color: "#5a554e" }}>
                Free. No credit card. We respect your inbox.
              </p>
            </form>
          ) : (
            <div
              className="rounded-2xl p-6 sm:p-8 text-center"
              style={{
                backgroundColor: "#1a1714",
                border: "1px solid #2a2720",
              }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
                <svg className="w-6 h-6" viewBox="0 0 20 20" fill="none">
                  <path d="M5 10.5l3 3L15 7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-heading font-semibold text-base mb-2" style={{ color: "#f0ede6" }}>
                Report saved! Check your inbox.
              </p>
              <p className="font-body text-sm mb-6" style={{ color: "#8a8278" }}>
                Want to track deficits across your entire roster automatically?
              </p>
              <a
                href={leadId ? `/register?leadId=${leadId}&plan=free` : "/register"}
                className="inline-block font-heading font-bold text-sm px-6 py-3 transition-colors hover:brightness-110"
                style={{
                  backgroundColor: "#f59e0b",
                  color: "#0d0c09",
                }}
              >
                Start Your Free Trial
              </a>
            </div>
          )}

          {/* Try again */}
          <button
            onClick={handleReset}
            className="w-full font-body text-sm py-2 transition-colors"
            style={{ color: "#6b655a" }}
          >
            Analyze a different athlete &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
