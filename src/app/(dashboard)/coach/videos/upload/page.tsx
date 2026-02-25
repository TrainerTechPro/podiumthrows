import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "./_upload-form";

export const metadata = { title: "Upload Video — Podium Throws" };

export default async function UploadVideoPage() {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  // Fetch athletes for the selector
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      events: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const athleteOptions = athletes.map((a) => ({
    value: a.id,
    label: `${a.firstName} ${a.lastName}`,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a
          href="/coach/videos"
          className="text-sm text-muted hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1 mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Video Library
        </a>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Upload Video
        </h1>
        <p className="text-sm text-muted mt-1">
          Upload a video to analyze technique, add annotations, and share with athletes.
        </p>
      </div>

      <UploadForm athleteOptions={athleteOptions} />
    </div>
  );
}
