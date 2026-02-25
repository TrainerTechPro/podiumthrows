import { requireCoachSession } from "@/lib/data/coach";
import { QuestionnaireBuilder } from "../_questionnaire-builder";

export default async function NewQuestionnairePage() {
  await requireCoachSession();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
        Create Questionnaire
      </h1>
      <QuestionnaireBuilder />
    </div>
  );
}
