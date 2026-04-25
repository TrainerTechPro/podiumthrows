import { redirect } from "next/navigation";
import { requireCoachSession, getExerciseLibrary, getAthletePickerList } from "@/lib/data/coach";
import { BuilderTabsClient } from "./_builder-tabs";

export const metadata = { title: "Builder — Podium Throws" };

export default async function CoachBuilderPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const [exercises, athletes] = await Promise.all([
    getExerciseLibrary(result.coach.id),
    getAthletePickerList(result.coach.id),
  ]);

  return (
    <BuilderTabsClient userId={result.session.userId} exercises={exercises} athletes={athletes} />
  );
}
