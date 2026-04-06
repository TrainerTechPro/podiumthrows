import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";
import { requireAthleteSession, getAthleteStats } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import {
  resolveConfig,
  type WidgetId,
  type DashboardConfig,
} from "./_widget-registry";
import { StaggeredList } from "@/components";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { CustomizeTrigger } from "./_customize-trigger";
import { StaleSessionChecker } from "./_stale-session-checker";
import { StreakReminder } from "@/components/notifications/StreakReminder";
import {
  fetchThisWeekData,
  fetchPRTrackerData,
  fetchWeeklyGoalData,
  type ThisWeekData,
  type PRTrackerData,
  type WeeklyGoalData,
} from "@/lib/data/dashboard-progress";
import { WearableDashboard } from "../_wearable-dashboard";
import { avg, type WhoopRow, type OuraRow } from "../_wearable-helpers";

/* ─── Fetchers ──────────────────────────────────────────────────────────── */

import {
  fetchReadinessData,
  fetchTodayWorkoutData,
  fetchCalendarData,
  fetchPRsData,
  fetchQuickStatsData,
  fetchGoalsData,
  fetchVolumeData,
  fetchUpcomingSessionsData,
  fetchVideosData,
  fetchQuestionnairesData,
  type ReadinessData,
  type TodaySession,
  type CalendarDay,
  type PRItem,
  type QuickStatsData,
  type GoalItem,
  type UpcomingSessionItem,
  type VideoItem,
  type QuestionnairesData,
} from "@/lib/data/dashboard";

/* ─── Widgets ───────────────────────────────────────────────────────────── */

import { ReadinessHeroWidget } from "./_widgets/readiness-hero";
import { TodayWorkoutWidget } from "./_widgets/today-workout";
import { WorkoutCalendarWidget } from "./_widgets/workout-calendar";
import { PersonalBestsWidget } from "./_widgets/personal-bests";
import { QuickStatsWidget } from "./_widgets/quick-stats";
import { GoalsProgressWidget } from "./_widgets/goals-progress";
import { TrainingVolumeWidget } from "./_widgets/training-volume";
import { UpcomingSessionsWidget } from "./_widgets/upcoming-sessions";
import { RecentVideosWidget } from "./_widgets/recent-videos";
import { PendingQuestionnairesWidget } from "./_widgets/pending-questionnaires";
import { ThisWeekWidget } from "./_widgets/this-week";
import { PRTrackerWidget } from "./_widgets/pr-tracker";
import { WeeklyGoalWidget } from "./_widgets/weekly-goal";

/* ─── Fetcher map ───────────────────────────────────────────────────────── */

const FETCHERS: Record<WidgetId, (id: string) => Promise<unknown>> = {
  readiness: fetchReadinessData,
  "today-workout": fetchTodayWorkoutData,
  calendar: fetchCalendarData,
  prs: fetchPRsData,
  "quick-stats": fetchQuickStatsData,
  goals: fetchGoalsData,
  volume: fetchVolumeData,
  "upcoming-sessions": fetchUpcomingSessionsData,
  videos: fetchVideosData,
  questionnaires: fetchQuestionnairesData,
  "this-week": fetchThisWeekData,
  "pr-tracker": fetchPRTrackerData,
  "weekly-goal": fetchWeeklyGoalData,
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function AthleteDashboardPage() {
  const { athlete } = await requireAthleteSession();

  // Fetch dashboard config + notification prefs from athlete profile
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athlete.id },
    select: { dashboardConfig: true, notificationPreferences: true },
  });

  const config: DashboardConfig = resolveConfig(profile?.dashboardConfig);

  // Parse notification preferences defensively — the JSON shape is
  // { streakReminder: { enabled, promptDismissed } } but the column is
  // nullable and could hold anything. Default both flags to false.
  const streakReminderPrefs = (() => {
    const raw = profile?.notificationPreferences as
      | { streakReminder?: { enabled?: unknown; promptDismissed?: unknown } }
      | null
      | undefined;
    const s = raw?.streakReminder;
    return {
      enabled: s?.enabled === true,
      promptDismissed: s?.promptDismissed === true,
    };
  })();
  const enabled = config.order.filter((w) => config.widgets.includes(w));

  // Parallel fetch: enabled widgets + header stats + wearable connections
  const [stats, whoopConn, ouraConn, ...entries] = await Promise.all([
    getAthleteStats(athlete.id),
    prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true, lastSyncAt: true },
    }),
    prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true, lastSyncAt: true },
    }),
    ...enabled.map(async (w) => [w, await FETCHERS[w](athlete.id)] as const),
  ]);

  const dataMap = Object.fromEntries(entries as [WidgetId, unknown][]);
  const hasWearable = whoopConn !== null || ouraConn !== null;

  // Fetch wearable snapshot data if connected
  const wearableData = await fetchWearableData(whoopConn, ouraConn);

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Practice hours: 2pm–8pm local (server-side)
  const isPracticeHours = hour >= 14 && hour < 20;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <StaleSessionChecker />
      <StreakReminder
        currentStreak={stats.currentStreak}
        initialEnabled={streakReminderPrefs.enabled}
        initialPromptDismissed={streakReminderPrefs.promptDismissed}
      />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              {greeting}, {athlete.firstName}.
            </h1>
            {stats.currentStreak > 0 && (
              <StreakBadge days={stats.currentStreak} isActive />
            )}
          </div>
          <p className="text-sm text-muted mt-0.5">{today}</p>
        </div>
        <CustomizeTrigger config={config} />
      </div>

      {/* Quick Log CTA */}
      <Link
        href="/athlete/quick-log"
        className="group relative block rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 p-6 shadow-lg transition-transform active:scale-[0.98]"
        aria-label="Quick Log — tap to log a throw in seconds"
      >
        {/* Pulse ring during practice hours */}
        {isPracticeHours && (
          <span
            className="absolute inset-0 rounded-2xl ring-2 ring-primary-400 animate-pulse pointer-events-none"
            aria-hidden="true"
          />
        )}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Zap size={28} strokeWidth={2} className="text-white" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-2xl font-bold text-white">Quick Log</h2>
            <p className="text-sm text-white/80">Tap to log a throw in seconds</p>
          </div>
          <ChevronRight
            size={24}
            strokeWidth={1.75}
            className="text-white/60 group-hover:text-white transition-colors shrink-0"
            aria-hidden="true"
          />
        </div>
        {isPracticeHours && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold">
              🎯 Practice time
            </span>
          </div>
        )}
      </Link>

      {/* Tabbed view: Training + Health */}
      {hasWearable ? (
        <Tabs defaultTab="training">
          <TabList variant="underline">
            <TabTrigger id="training" variant="underline">Training</TabTrigger>
            <TabTrigger id="health" variant="underline">Health</TabTrigger>
          </TabList>

          <TabPanel id="training">
            <StaggeredList className="space-y-5" staggerDelay={60}>
              {enabled.map((widgetId) => (
                <WidgetRenderer
                  key={widgetId}
                  id={widgetId}
                  data={dataMap[widgetId]}
                />
              ))}
            </StaggeredList>
          </TabPanel>

          <TabPanel id="health">
            <div className="space-y-8">
              {wearableData.whoop && (
                <WearableDashboard
                  device="whoop"
                  today={wearableData.whoop.todayRow}
                  history={wearableData.whoop.historyRows}
                  averages={wearableData.whoop.averages}
                  lastSyncAt={wearableData.whoop.lastSyncAt}
                />
              )}
              {wearableData.oura && (
                <WearableDashboard
                  device="oura"
                  today={wearableData.oura.todayRow}
                  history={wearableData.oura.historyRows}
                  averages={wearableData.oura.averages}
                  lastSyncAt={wearableData.oura.lastSyncAt}
                />
              )}
              <p className="text-xs text-muted text-center">
                <Link href="/athlete/settings" className="text-primary-500 hover:underline">
                  Manage integrations
                </Link>
              </p>
            </div>
          </TabPanel>
        </Tabs>
      ) : (
        /* No wearable connected — show training widgets directly (no tabs) */
        <StaggeredList className="space-y-5" staggerDelay={60}>
          {enabled.map((widgetId) => (
            <WidgetRenderer
              key={widgetId}
              id={widgetId}
              data={dataMap[widgetId]}
            />
          ))}
        </StaggeredList>
      )}
    </div>
  );
}

/* ─── Wearable Data Fetcher ─────────────────────────────────────────────── */

interface WearableDataResult {
  whoop: { todayRow: WhoopRow | null; historyRows: WhoopRow[]; averages: Record<string, number | null>; lastSyncAt: Date | null } | null;
  oura: { todayRow: OuraRow | null; historyRows: OuraRow[]; averages: Record<string, number | null>; lastSyncAt: Date | null } | null;
}

async function fetchWearableData(
  whoopConn: { id: string; lastSyncAt: Date | null } | null,
  ouraConn: { id: string; lastSyncAt: Date | null } | null,
): Promise<WearableDataResult> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const result: WearableDataResult = { whoop: null, oura: null };

  if (whoopConn) {
    const snapshots = await prisma.whoopDailySnapshot.findMany({
      where: { connectionId: whoopConn.id },
      orderBy: { date: "desc" },
      take: 30,
    });
    const last7 = snapshots.slice(0, 7);
    const historyRows: WhoopRow[] = snapshots.map((s) => ({
      id: s.id, date: s.date,
      recoveryScore: s.recoveryScore, hrvMs: s.hrvMs, restingHR: s.restingHR,
      spo2: s.spo2, skinTempC: s.skinTempC, strain: s.strain,
      sleepPerformance: s.sleepPerformance, sleepDurationMs: s.sleepDurationMs,
      sleepEfficiency: s.sleepEfficiency, lightSleepMs: s.lightSleepMs,
      swsSleepMs: s.swsSleepMs, remSleepMs: s.remSleepMs,
    }));
    result.whoop = {
      todayRow: historyRows.find((r) => r.date === todayStr) ?? null,
      historyRows,
      averages: {
        recoveryScore: avg(last7.map((s) => s.recoveryScore)),
        hrvMs: avg(last7.map((s) => s.hrvMs)),
        restingHR: avg(last7.map((s) => s.restingHR)),
        spo2: avg(last7.map((s) => s.spo2)),
        skinTempC: avg(last7.map((s) => s.skinTempC)),
        strain: avg(last7.map((s) => s.strain)),
        sleepDurationMs: avg(last7.map((s) => s.sleepDurationMs)),
        sleepEfficiency: avg(last7.map((s) => s.sleepEfficiency)),
        sleepPerformance: avg(last7.map((s) => s.sleepPerformance)),
      },
      lastSyncAt: whoopConn.lastSyncAt,
    };
  }

  if (ouraConn) {
    const snapshots = await prisma.ouraDailySnapshot.findMany({
      where: { connectionId: ouraConn.id },
      orderBy: { date: "desc" },
      take: 30,
    });
    const last7 = snapshots.slice(0, 7);
    const historyRows: OuraRow[] = snapshots.map((s) => ({
      id: s.id, date: s.date,
      readinessScore: s.readinessScore, hrvMs: s.hrvMs, restingHR: s.restingHR,
      spo2: s.spo2, temperatureDeviation: s.temperatureDeviation,
      sleepScore: s.sleepScore, sleepDurationSec: s.sleepDurationSec,
      sleepEfficiency: s.sleepEfficiency, lightSleepSec: s.lightSleepSec,
      deepSleepSec: s.deepSleepSec, remSleepSec: s.remSleepSec,
      activityScore: s.activityScore, steps: s.steps,
    }));
    result.oura = {
      todayRow: historyRows.find((r) => r.date === todayStr) ?? null,
      historyRows,
      averages: {
        readinessScore: avg(last7.map((s) => s.readinessScore)),
        hrvMs: avg(last7.map((s) => s.hrvMs)),
        restingHR: avg(last7.map((s) => s.restingHR)),
        spo2: avg(last7.map((s) => s.spo2)),
        temperatureDeviation: avg(last7.map((s) => s.temperatureDeviation)),
        sleepScore: avg(last7.map((s) => s.sleepScore)),
        sleepDurationSec: avg(last7.map((s) => s.sleepDurationSec)),
        sleepEfficiency: avg(last7.map((s) => s.sleepEfficiency)),
        activityScore: avg(last7.map((s) => s.activityScore)),
      },
      lastSyncAt: ouraConn.lastSyncAt,
    };
  }

  return result;
}

/* ─── Widget Renderer ───────────────────────────────────────────────────── */

function WidgetRenderer({ id, data }: { id: WidgetId; data: unknown }) {
  switch (id) {
    case "readiness":
      return <ReadinessHeroWidget data={data as ReadinessData} />;
    case "today-workout":
      return <TodayWorkoutWidget data={data as TodaySession[]} />;
    case "calendar":
      return <WorkoutCalendarWidget days={data as CalendarDay[]} />;
    case "prs":
      return <PersonalBestsWidget prs={data as PRItem[]} />;
    case "quick-stats":
      return <QuickStatsWidget data={data as QuickStatsData} />;
    case "goals":
      return <GoalsProgressWidget goals={data as GoalItem[]} />;
    case "volume":
      return <TrainingVolumeWidget />;
    case "upcoming-sessions":
      return (
        <UpcomingSessionsWidget
          sessions={data as UpcomingSessionItem[]}
        />
      );
    case "videos":
      return <RecentVideosWidget videos={data as VideoItem[]} />;
    case "questionnaires":
      return <PendingQuestionnairesWidget data={data as QuestionnairesData} />;
    case "this-week":
      return <ThisWeekWidget data={data as ThisWeekData} />;
    case "pr-tracker":
      return <PRTrackerWidget data={data as PRTrackerData} />;
    case "weekly-goal":
      return <WeeklyGoalWidget data={data as WeeklyGoalData} />;
    default:
      return null;
  }
}
