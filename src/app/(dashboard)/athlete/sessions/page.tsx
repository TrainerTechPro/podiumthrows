import { requireAthleteSession } from "@/lib/data/athlete";
import { fetchTrainingHubData } from "@/lib/data/training-hub";
import { TrainingHub } from "./_training-hub";

export default async function AthleteTrainingPage() {
  const { athlete } = await requireAthleteSession();
  const data = await fetchTrainingHubData(athlete.id);

  const subtitle =
    data.state === "active"
      ? data.todaySessions.length > 0
        ? "Today's session is up first."
        : data.nextSession
          ? `Next: ${data.nextSession.name}`
          : "Nothing scheduled yet."
      : data.state === "between"
        ? "Between cycles — keep moving."
        : "No program yet — get one started.";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header — state-specific subtitle, never a generic welcome.
          Cold-start athletes still get a useful next step from the body. */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Training</h1>
        <p className="text-sm text-muted mt-0.5">{subtitle}</p>
      </div>

      {/* Hub */}
      <TrainingHub data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
