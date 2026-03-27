import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Video, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { VideoAnalysisCard } from "@/components/video-analysis/VideoAnalysisCard";

export const metadata = { title: "Video Analysis — Podium Throws" };

type SearchParams = {
  athleteId?: string;
  event?: string;
};

export default async function VideoAnalysisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  // Build filter
  const where: Record<string, unknown> = { coachId: coach.id };
  if (searchParams.athleteId) where.athleteId = searchParams.athleteId;
  if (searchParams.event) where.event = searchParams.event;

  // Fetch analyses and athletes in parallel
  const [analyses, athletes] = await Promise.all([
    prisma.videoAnalysis.findMany({
      where,
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.athleteProfile.findMany({
      where: { coachId: coach.id },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const events = [
    { value: "", label: "All Events" },
    { value: "SHOT_PUT", label: "Shot Put" },
    { value: "DISCUS", label: "Discus" },
    { value: "HAMMER", label: "Hammer" },
    { value: "JAVELIN", label: "Javelin" },
  ];

  function buildFilterUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.athleteId) params.set("athleteId", merged.athleteId);
    if (merged.event) params.set("event", merged.event);
    return `/coach/video-analysis${params.toString() ? `?${params}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Video Analysis</h1>
          <p className="text-sm text-muted mt-0.5">
            {analyses.length} analys{analyses.length === 1 ? "is" : "es"}
          </p>
        </div>
        <Link href="/coach/video-analysis/upload" className="btn-primary flex items-center gap-1.5">
          <Upload size={16} strokeWidth={2} aria-hidden="true" />
          Upload Video
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Athlete filter */}
        <select
          defaultValue={searchParams.athleteId || ""}
          onChange={() => {
            // Server component — use link-based filtering via event pills
          }}
          className="input text-sm w-44"
          aria-label="Filter by athlete"
        >
          <option value="">All Athletes</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.firstName} {a.lastName}
            </option>
          ))}
        </select>

        {/* Event pills */}
        <div className="flex items-center gap-1.5">
          {events.map((ev) => {
            const isActive = (searchParams.event || "") === ev.value;
            return (
              <Link
                key={ev.value}
                href={buildFilterUrl({ event: ev.value })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-500/20 text-primary-500 border border-primary-500/30"
                    : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                {ev.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {analyses.length === 0 ? (
        <EmptyState
          icon={<Video size={24} strokeWidth={1.5} aria-hidden="true" />}
          title="No video analyses yet"
          description="Upload your first throw video to start analyzing technique with AI-powered pose detection."
          action={
            <Link href="/coach/video-analysis/upload" className="btn-primary">
              Upload Video
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map((analysis) => (
            <VideoAnalysisCard
              key={analysis.id}
              analysis={{
                ...analysis,
                createdAt: analysis.createdAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
