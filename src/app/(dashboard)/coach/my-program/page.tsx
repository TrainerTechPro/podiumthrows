"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import ProgramOverviewTab from "./_components/program-overview-tab";
import ProgramAnalyticsTab from "./_components/program-analytics-tab";
import ProgramAnalysisTab from "./_components/program-analysis-tab";

interface ProgramData {
  id: string;
  event: string;
  gender: string;
  status: string;
  startDate: string;
  targetDate: string | null;
  goalDistance: number | null;
  startingPr: number | null;
  daysPerWeek: number;
  sessionsPerDay: number;
  includeLift: boolean;
  currentWeekNumber: number;
  currentPhaseId: string | null;
  shortTermGoalLabel: string | null;
  longTermGoalLabel: string | null;
  longTermGoalDistance: number | null;
  competitionCalendar: string | null;
  generationConfig: string;
  phases: PhaseData[];
}

interface PhaseData {
  id: string;
  phase: string;
  phaseOrder: number;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
  throwsPerWeekTarget: number;
  strengthDaysTarget: number;
  status: string;
  _count: { sessions: number };
}

interface SessionData {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  sessionType: string;
  focusLabel: string;
  totalThrowsTarget: number;
  estimatedDuration: number;
  status: string;
}

interface ReasoningCard {
  id: string;
  title: string;
  brief: string;
  details: string;
  category: "phase" | "volume" | "exercise" | "taper" | "deficit";
  reference?: string;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer Throw",
  JAVELIN: "Javelin",
};

export default function MyProgramPage() {
  const searchParams = useSearchParams();
  const justGenerated = searchParams.get("generated");

  const [program, setProgram] = useState<ProgramData | null>(null);
  const [todaySessions, setTodaySessions] = useState<SessionData[]>([]);
  const [weekSessions, setWeekSessions] = useState<SessionData[]>([]);
  const [reasoningCards, setReasoningCards] = useState<ReasoningCard[]>([]);
  const [analyticsData, setAnalyticsData] = useState<Record<string, unknown> | null>(null);
  const [adaptationProgress, setAdaptationProgress] = useState<{ progress: number; phase: string; label: string } | null>(null);
  const [currentPr, setCurrentPr] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setFetchError("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach/my-program", { signal });
      if (!res.ok) {
        setProgram(null);
        setLoading(false);
        return;
      }

      let json;
      try { json = await res.json(); } catch { json = { data: null }; }
      const data = json?.data;

      if (!data) {
        setProgram(null);
        setLoading(false);
        return;
      }

      setProgram(data);

      // Extract reasoning cards from generation config
      try {
        const config = JSON.parse(data.generationConfig || "{}");
        if (Array.isArray(config.reasoningCards)) {
          setReasoningCards(config.reasoningCards);
        }
      } catch { /* invalid JSON — non-critical */ }

      // Fetch today, week sessions, and analytics in parallel
      // These are supplementary — failures should not block the page
      const results = await Promise.allSettled([
        fetch(`/api/throws/program/${data.id}/today`, { signal }),
        fetch(`/api/throws/program/${data.id}/week`, { signal }),
        fetch("/api/coach/my-program/analytics", { signal }),
      ]);

      const [todayResult, weekResult, analyticsResult] = results;

      if (todayResult.status === "fulfilled" && todayResult.value.ok) {
        try {
          const td = await todayResult.value.json();
          setTodaySessions(td.data?.sessions ?? []);
        } catch { /* non-JSON response */ }
      }
      if (weekResult.status === "fulfilled" && weekResult.value.ok) {
        try {
          const wk = await weekResult.value.json();
          setWeekSessions(wk.data?.sessions ?? []);
        } catch { /* non-JSON response */ }
      }
      if (analyticsResult.status === "fulfilled" && analyticsResult.value.ok) {
        try {
          const analytics = await analyticsResult.value.json();
          if (analytics.data) setAnalyticsData(analytics.data as Record<string, unknown>);
          if (analytics.data?.adaptationProgress) {
            setAdaptationProgress(analytics.data.adaptationProgress);
          }
          // Extract best mark for goal progress
          const marks = analytics.data?.weeklyData?.marks as number[] | undefined;
          if (marks && marks.length > 0) {
            const positiveMarks = marks.filter((m: number) => m > 0);
            if (positiveMarks.length > 0) {
              const best = Math.max(...positiveMarks);
              if (Number.isFinite(best) && best > 0) setCurrentPr(best);
            }
          }
        } catch { /* non-JSON response */ }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFetchError("Failed to load program. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted">Loading program...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
        <button
          onClick={() => load()}
          className="btn-secondary text-sm px-5 py-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No program — show onboarding CTA
  if (!program) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary-500/[0.12] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--color-gold-dark)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-title font-heading text-[var(--foreground)] mb-2">
          No Program Yet
        </h1>
        <p className="text-body text-muted mb-8">
          Create a Bondarchuk-based training program tailored to your event,
          equipment, and adaptation profile.
        </p>
        <Link href="/coach/my-program/onboard" className="btn-primary px-8 py-3 inline-block">
          Create Your Program
        </Link>
      </div>
    );
  }

  // ── Active Program Dashboard ──────────────────────────────────────
  const totalWeeks = program.phases.reduce((sum, p) => Math.max(sum, p.endWeek), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Success banner */}
      {justGenerated && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl animate-fade-in">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Program generated successfully! Your training plan is ready.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-title font-heading text-[var(--foreground)]">
            My Program
          </h1>
          <p className="text-body text-muted">
            {EVENT_LABELS[program.event] ?? program.event} &middot; Week{" "}
            {program.currentWeekNumber} of {totalWeeks}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            program.status === "ACTIVE"
              ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
              : "bg-[var(--muted-bg)] text-muted"
          }`}
        >
          {program.status}
        </span>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="overview">
        <TabList variant="boxed" className="mb-6">
          <TabTrigger id="overview" variant="boxed">Overview</TabTrigger>
          <TabTrigger id="analytics" variant="boxed">Analytics</TabTrigger>
          <TabTrigger id="analysis" variant="boxed">Analysis</TabTrigger>
        </TabList>

        <TabPanel id="overview">
          <ProgramOverviewTab
            program={program}
            todaySessions={todaySessions}
            weekSessions={weekSessions}
            reasoningCards={reasoningCards}
            adaptationProgress={adaptationProgress ?? undefined}
            currentPr={currentPr ?? undefined}
          />
        </TabPanel>

        <TabPanel id="analytics">
          <ProgramAnalyticsTab programId={program.id} analyticsData={analyticsData} />
        </TabPanel>

        <TabPanel id="analysis">
          <ProgramAnalysisTab
            programId={program.id}
            phases={program.phases}
            analyticsData={analyticsData}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
}
