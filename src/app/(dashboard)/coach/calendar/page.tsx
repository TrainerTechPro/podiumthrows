import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCoachSession, getAthletePickerList } from "@/lib/data/coach";
import { getCoachPractices } from "@/lib/data/practices";
import { getTeamAvailability } from "@/lib/data/availability";
import { getEventGroups } from "@/lib/data/event-groups";
import { CalendarTabsClient } from "./_calendar-tabs";

export const metadata = { title: "Calendar — Podium Throws" };

const FILTER_LABEL: Record<string, string> = {
  "not-started": "Assigned this week, not started",
  completed: "Completed this week",
};

export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const startDate = monday.toISOString().split("T")[0];
  const endDate = sunday.toISOString().split("T")[0];

  const filter =
    searchParams?.filter && FILTER_LABEL[searchParams.filter] ? searchParams.filter : null;

  const [practices, availability, athletes, eventGroups] = await Promise.all([
    getCoachPractices(result.coach.id, startDate, endDate),
    getTeamAvailability(result.coach.id),
    getAthletePickerList(result.coach.id),
    getEventGroups(result.coach.id),
  ]);

  return (
    <>
      {filter && (
        <div
          data-testid="calendar-filter-banner"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3"
        >
          <p className="text-sm text-[var(--foreground)]">
            <strong className="font-semibold">From dashboard:</strong> {FILTER_LABEL[filter]}
            <span className="text-muted"> · scroll the week below to find them.</span>
          </p>
          <Link
            href="/coach/calendar"
            className="text-xs font-medium text-primary-500 hover:underline shrink-0"
          >
            Clear ×
          </Link>
        </div>
      )}
      <CalendarTabsClient
        initialPractices={practices}
        initialStartDate={startDate}
        initialEndDate={endDate}
        availabilityData={availability}
        athletes={athletes}
        eventGroups={eventGroups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </>
  );
}
