import { requireAthleteSession } from "@/lib/data/athlete";
import { fetchTrainingHubData } from "@/lib/data/training-hub";
import { TrainingHub } from "./_training-hub";

/* Five-state status-aware header — generic "Training" h1 was a junk-drawer
   signal. The pill answers "what's the state of my training?" at a glance;
   the h1 names the unit of work. State map:
     active + today + IN_PROGRESS    → pill "In progress" / "<n> sessions today"
     active + today                  → pill "Due today"   / "<n> sessions today"
     active + nextSession            → pill "Up next"     / "Session in Nd"
     active + nothing                → pill "Rest day"    / "Quick Log"
     between                         → pill "Between blocks" / "Session up next"
     cold-start                      → pill "Getting started" / "First session" */

type HeaderState = { pill: string; heading: string; subtitle: string };

export default async function AthleteTrainingPage() {
  const { athlete } = await requireAthleteSession();
  const data = await fetchTrainingHubData(athlete.id);
  const header = buildHeader(data);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <span className="inline-flex items-center rounded-full bg-primary-500/10 px-2.5 py-0.5 text-caption font-medium text-primary-600 dark:text-primary-400">
          {header.pill}
        </span>
        <h1 className="mt-1.5 text-2xl font-bold font-heading text-[var(--foreground)]">
          {header.heading}
        </h1>
        <p className="text-sm text-muted mt-0.5">{header.subtitle}</p>
      </div>

      <TrainingHub data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}

function buildHeader(data: Awaited<ReturnType<typeof fetchTrainingHubData>>): HeaderState {
  if (data.state === "between") {
    return {
      pill: "Between blocks",
      heading: "Session up next",
      subtitle: "Between cycles — keep moving.",
    };
  }
  if (data.state === "cold-start") {
    return {
      pill: "Getting started",
      heading: "First session",
      subtitle: "No program yet — get one started.",
    };
  }

  const todayCount = data.todaySessions.length;
  if (todayCount > 0) {
    const anyInProgress = data.todaySessions.some((s) => s.status === "IN_PROGRESS");
    const sessionWord = todayCount === 1 ? "session" : "sessions";
    return {
      pill: anyInProgress ? "In progress" : "Due today",
      heading: `${todayCount} ${sessionWord} today`,
      subtitle: anyInProgress ? "Pick up where you left off." : "Today's session is up first.",
    };
  }

  if (data.nextSession) {
    return {
      pill: "Up next",
      heading: `Session in ${data.nextSession.daysUntil}d`,
      subtitle: `Next: ${data.nextSession.name}`,
    };
  }

  return {
    pill: "Rest day",
    heading: "Quick Log",
    subtitle: "Nothing scheduled — log a session if you train today.",
  };
}
