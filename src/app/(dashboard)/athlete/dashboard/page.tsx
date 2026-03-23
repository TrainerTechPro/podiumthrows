import { requireAthleteSession, getAthleteStats } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import {
  resolveConfig,
  type WidgetId,
  type DashboardConfig,
} from "./_widget-registry";
import { StaggeredList } from "@/components";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { CustomizeTrigger } from "./_customize-trigger";

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
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function AthleteDashboardPage() {
  const { athlete } = await requireAthleteSession();

  // Fetch dashboard config from athlete profile
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athlete.id },
    select: { dashboardConfig: true },
  });

  const config: DashboardConfig = resolveConfig(profile?.dashboardConfig);
  const enabled = config.order.filter((w) => config.widgets.includes(w));

  // Parallel fetch: only enabled widgets + header stats
  const [stats, ...entries] = await Promise.all([
    getAthleteStats(athlete.id),
    ...enabled.map(async (w) => [w, await FETCHERS[w](athlete.id)] as const),
  ]);

  const dataMap = Object.fromEntries(entries as [WidgetId, unknown][]);

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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

      {/* Widgets in order */}
      <StaggeredList className="space-y-5" staggerDelay={60}>
        {enabled.map((widgetId) => (
          <WidgetRenderer
            key={widgetId}
            id={widgetId}
            data={dataMap[widgetId]}
          />
        ))}
      </StaggeredList>
    </div>
  );
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
    default:
      return null;
  }
}
