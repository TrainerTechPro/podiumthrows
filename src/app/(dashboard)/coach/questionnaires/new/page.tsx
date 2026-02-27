import { requireCoachSession } from "@/lib/data/coach";
import { FormBuilderShell } from "@/components/form-builder";

export default async function NewQuestionnairePage() {
  await requireCoachSession();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <a
          href="/coach/questionnaires"
          className="text-muted hover:text-[var(--foreground)] transition-colors"
          aria-label="Back to questionnaires"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </a>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Create Questionnaire
        </h1>
      </div>
      <FormBuilderShell />
    </div>
  );
}
