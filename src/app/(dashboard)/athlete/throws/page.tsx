import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";
import { StaggeredList } from "@/components";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { requireAthleteSession } from "@/lib/data/athlete";
import { UpcomingSessionsWidget } from "../dashboard/_widgets/upcoming-sessions";
import type { UpcomingSessionItem } from "@/lib/data/dashboard";
import type { WidgetId } from "../dashboard/_widget-registry";
import {
  FETCHERS as DASHBOARD_FETCHERS,
  WidgetRenderer,
} from "../_shared/widget-renderer";
import { fetchUpcomingThrowsAssignments } from "@/lib/data/throws-hub";

export const metadata = {
  title: "Throws",
};

// The six widgets shown on the Throws Hub, in render order.
// See docs/superpowers/specs/2026-04-11-throws-hub-widget-composition-design.md §1.2.
const THROWS_HUB_WIDGETS: WidgetId[] = [
  "readiness",
  "today-workout",
  "pr-tracker",
  "this-week",
  "volume",
  "upcoming-sessions",
];

// The fetcher map overrides exactly ONE entry (upcoming-sessions) with
// the throws-specific fetcher. All other widgets use the dashboard's
// existing fetchers, which are throws-relevant by data model.
const THROWS_HUB_FETCHERS = {
  ...DASHBOARD_FETCHERS,
  "upcoming-sessions": fetchUpcomingThrowsAssignments,
};

// Route upcoming session clicks to the right throws destination based on
// assignment status. IN_PROGRESS → live player. Everything else → read-only view.
function throwsLinkHrefBuilder(session: UpcomingSessionItem): string {
  return session.status === "IN_PROGRESS"
    ? `/athlete/throws/live/${session.id}`
    : `/athlete/throws/session/${session.id}`;
}

export default async function ThrowsHubPage() {
  const { athlete } = await requireAthleteSession();

  // Parallel fetch for all 6 widgets.
  const entries = await Promise.all(
    THROWS_HUB_WIDGETS.map(
      async (w) => [w, await THROWS_HUB_FETCHERS[w](athlete.id)] as const
    )
  );
  const dataMap = Object.fromEntries(entries as [WidgetId, unknown][]);

  const hour = new Date().getHours();
  const isPracticeHours = hour >= 14 && hour < 20;

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ScrollProgressBar />

      {/* Header */}
      <div>
        <h1 className="text-display font-heading text-[var(--foreground)]">Throws</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Your throws training at a glance
        </p>
      </div>

      {/* Quick Log CTA — mirrors the dashboard's hero button */}
      <Link
        href="/athlete/quick-log"
        className="group relative block rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 p-6 shadow-lg transition-transform active:scale-[0.98]"
        aria-label="Quick Log — tap to log a throw in seconds"
      >
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

      {/* Widget stack */}
      <StaggeredList className="space-y-5" staggerDelay={60}>
        {THROWS_HUB_WIDGETS.map((widgetId) => {
          // upcoming-sessions gets rendered directly so we can pass the
          // throws-aware linkHrefBuilder. All other widgets go through
          // the shared WidgetRenderer dispatch.
          if (widgetId === "upcoming-sessions") {
            return (
              <UpcomingSessionsWidget
                key={widgetId}
                sessions={dataMap[widgetId] as UpcomingSessionItem[]}
                linkHrefBuilder={throwsLinkHrefBuilder}
              />
            );
          }
          return (
            <WidgetRenderer
              key={widgetId}
              id={widgetId}
              data={dataMap[widgetId]}
            />
          );
        })}
      </StaggeredList>
    </div>
  );
}
