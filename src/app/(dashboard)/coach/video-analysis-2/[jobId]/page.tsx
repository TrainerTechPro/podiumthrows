import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCoachSession } from "@/lib/data/coach";
import { AnalysisResultView } from "@/components/analysis/AnalysisResultView";

export const metadata = { title: "Analysis — Podium Throws" };
export const dynamic = "force-dynamic";

export default async function AnalysisJobPage({
  params,
}: {
  params: { jobId: string };
}) {
  await requireCoachSession();
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Link
        href="/coach/video-analysis-2"
        className="inline-flex items-center gap-1 text-caption text-muted hover:underline"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        All analyses
      </Link>
      <AnalysisResultView jobId={params.jobId} />
    </div>
  );
}
