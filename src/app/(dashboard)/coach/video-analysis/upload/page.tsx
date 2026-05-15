import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { VideoUploadForm } from "@/components/video-analysis/VideoUploadForm";
import type { SessionOption } from "@/components/video-analysis/VideoUploadForm";

export const metadata = { title: "Upload Video — Pose Analysis — Podium Throws" };

export default async function VideoAnalysisUploadPage() {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  // Fetch coach's athletes for the selector
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Recent sessions per athlete (last 30 days) — bounded by coach.athletes,
  // surfaces a session picker so the upload anchors to the work it captures.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSessions = await prisma.trainingSession.findMany({
    where: {
      athleteId: { in: athletes.map((a) => a.id) },
      scheduledDate: { gte: thirtyDaysAgo },
    },
    orderBy: { scheduledDate: "desc" },
    select: {
      id: true,
      athleteId: true,
      scheduledDate: true,
      status: true,
      plan: { select: { name: true } },
    },
    take: 250,
  });
  const sessionsByAthlete = recentSessions.reduce<Record<string, SessionOption[]>>((acc, s) => {
    const list = acc[s.athleteId] ?? (acc[s.athleteId] = []);
    list.push({
      id: s.id,
      label: `${s.plan?.name ?? "Session"} — ${s.scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      status: s.status,
    });
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link
          href="/coach/video-analysis"
          className="hover:text-[var(--foreground)] transition-colors"
        >
          Pose Analysis
        </Link>
        <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-[var(--foreground)]">Upload</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Upload Video</h1>
        <p className="text-sm text-muted mt-0.5">
          Upload a throw video to analyze with AI-powered pose detection
        </p>
      </div>

      {/* Form */}
      <div className="card p-6">
        <VideoUploadForm athletes={athletes} sessionsByAthlete={sessionsByAthlete} />
      </div>
    </div>
  );
}
