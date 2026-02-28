import { requireCoachSession, getAthletePickerList } from "@/lib/data/coach";
import { ProgramBuilderWizard } from "./_program-builder-wizard";

export default async function ProgramBuilderPage() {
  const { coach } = await requireCoachSession();
  const athletes = await getAthletePickerList(coach.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <ProgramBuilderWizard athletes={athletes} />
    </div>
  );
}
