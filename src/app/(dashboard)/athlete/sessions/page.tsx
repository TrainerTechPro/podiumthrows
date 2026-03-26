import { requireAthleteSession } from "@/lib/data/athlete";
import { fetchTrainingHubData } from "@/lib/data/training-hub";
import { TrainingHub } from "./_training-hub";

export default async function AthleteTrainingPage() {
  const { athlete } = await requireAthleteSession();
  const data = await fetchTrainingHubData(athlete.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Training
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {data.state === "active"
            ? "Here's what's on deck"
            : data.state === "between"
              ? "Great work this week"
              : "Welcome to Podium Throws"}
        </p>
      </div>

      {/* Hub */}
      <TrainingHub data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
