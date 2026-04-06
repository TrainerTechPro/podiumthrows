import { requireAthleteSession } from "@/lib/data/athlete";
import { fetchAthleteFeedback } from "@/lib/data/athlete-feedback";
import { FeedbackList } from "./_feedback-list";

export const dynamic = "force-dynamic";

export default async function AthleteFeedbackPage() {
  const { athlete } = await requireAthleteSession();
  const items = await fetchAthleteFeedback(athlete.id);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Coach Feedback
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Everything your coach has left you, newest first.
        </p>
      </div>

      <FeedbackList initialItems={items} />
    </div>
  );
}
