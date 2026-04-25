import { StaggeredList } from "@/components";
import { requireAthleteSession } from "@/lib/data/athlete";
import type { WidgetId } from "../dashboard/_widget-registry";
import { FETCHERS, WidgetRenderer } from "../_shared/widget-renderer";
import { ThrowsChipNav } from "./_chip-nav";

export const metadata = {
  title: "Throws",
};

// Throws Hub is a scoped analytics surface. Today's session and the Quick
// Log entry point live on the dashboard (state-aware hero) and the bottom
// tab bar's Log button respectively — never duplicated here.
const THROWS_HUB_WIDGETS: WidgetId[] = ["readiness", "pr-tracker", "this-week", "volume"];

export default async function ThrowsHubPage() {
  const { athlete } = await requireAthleteSession();

  const entries = await Promise.all(
    THROWS_HUB_WIDGETS.map(async (w) => [w, await FETCHERS[w](athlete.id)] as const)
  );
  const dataMap = Object.fromEntries(entries as [WidgetId, unknown][]);

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ThrowsChipNav />

      <div>
        <h1 className="text-display font-heading text-[var(--foreground)]">Throws</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Trends, PRs, and volume across your throws.
        </p>
      </div>

      <StaggeredList className="space-y-5" staggerDelay={60}>
        {THROWS_HUB_WIDGETS.map((widgetId) => (
          <WidgetRenderer key={widgetId} id={widgetId} data={dataMap[widgetId]} />
        ))}
      </StaggeredList>
    </div>
  );
}
