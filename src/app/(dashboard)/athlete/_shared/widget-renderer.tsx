// Shared widget infrastructure: WidgetRenderer dispatch + FETCHERS map.
// Extracted from dashboard/page.tsx so the throws hub can reuse it.

import type { WidgetId } from "../dashboard/_widget-registry";

/* ─── Widgets ───────────────────────────────────────────────────────────── */

import { ReadinessHeroWidget } from "../dashboard/_widgets/readiness-hero";
import { TodayWorkoutWidget } from "../dashboard/_widgets/today-workout";
import { WorkoutCalendarWidget } from "../dashboard/_widgets/workout-calendar";
import { PersonalBestsWidget } from "../dashboard/_widgets/personal-bests";
import { QuickStatsWidget } from "../dashboard/_widgets/quick-stats";
import { GoalsProgressWidget } from "../dashboard/_widgets/goals-progress";
import { TrainingVolumeWidget } from "../dashboard/_widgets/training-volume";
import { UpcomingSessionsWidget } from "../dashboard/_widgets/upcoming-sessions";
import { RecentVideosWidget } from "../dashboard/_widgets/recent-videos";
import { PendingQuestionnairesWidget } from "../dashboard/_widgets/pending-questionnaires";
import { ThisWeekWidget } from "../dashboard/_widgets/this-week";
import { PRTrackerWidget } from "../dashboard/_widgets/pr-tracker";
import { WeeklyGoalWidget } from "../dashboard/_widgets/weekly-goal";

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
import {
  fetchThisWeekData,
  fetchPRTrackerData,
  fetchWeeklyGoalData,
  type ThisWeekData,
  type PRTrackerData,
  type WeeklyGoalData,
} from "@/lib/data/dashboard-progress";

/* ─── Fetcher map ───────────────────────────────────────────────────────── */

export const FETCHERS: Record<WidgetId, (id: string) => Promise<unknown>> = {
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

/* ─── Widget Renderer ───────────────────────────────────────────────────── */

export function WidgetRenderer({ id, data }: { id: WidgetId; data: unknown }) {
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
