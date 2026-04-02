import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Video, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { VideoAnalysisCard } from "@/components/video-analysis/VideoAnalysisCard";
import { AnalysisSummary, type LatestInsight } from "@/components/video-analysis/AnalysisSummary";
import { getAnglesWithStatus, type ThrowAngles } from "@/lib/pose-angles";
import { AthleteFilter } from "./_athlete-filter";

export const metadata = { title: "Pose Analysis — Podium Throws" };

type SearchParams = {
  athleteId?: string;
  event?: string;
};

/* ─── Summary constants (module-level to avoid per-request allocation) ──── */

const SUMMARY_ANGLE_KEYS = ["shoulderSeparation", "hipShoulderDifferential", "blockLegKnee"];
const SUMMARY_LABELS: Record<string, string> = {
  shoulderSeparation: "Shldr Sep",
  hipShoulderDifferential: "Hip-Shldr",
  blockLegKnee: "Block Knee",
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

  // ── Summary stats ──────────────────────────────────────────────────────
  const completedCount = analyses.filter((a) => a.status === "COMPLETED").length;
  const eventCounts: Record<string, number> = {};
  for (const a of analyses) {
    eventCounts[a.event] = (eventCounts[a.event] || 0) + 1;
  }

  // Latest completed analysis with key angle data
  let latestInsight: LatestInsight | null = null;
  const latestCompleted = analyses.find(
    (a) => a.status === "COMPLETED" && a.keyPositions,
  );

  if (latestCompleted) {
    type KPJson = { positions?: Array<{ label: string; angles?: Record<string, number> }> };
    const kp = latestCompleted.keyPositions as KPJson | null;
    const positions = kp?.positions || [];
    const bestPos = positions.find((p) => p.label === "Release") || positions[positions.length - 1];

    let keyAngles: LatestInsight["angles"] = null;
    if (bestPos?.angles) {
      try {
        const allAngles = getAnglesWithStatus(bestPos.angles as ThrowAngles);
        keyAngles = allAngles
          .filter((a) => SUMMARY_ANGLE_KEYS.includes(a.key))
          .map((a) => ({
            key: a.key,
            label: SUMMARY_LABELS[a.key] || a.label,
            degrees: a.degrees,
            status: a.status,
          }));
      } catch {
        // Malformed angle data in JSON — skip silently
      }
    }

    latestInsight = {
      id: latestCompleted.id,
      title: latestCompleted.title,
      event: latestCompleted.event,
      athleteName: `${latestCompleted.athlete.firstName} ${latestCompleted.athlete.lastName}`,
      angles: keyAngles,
    };
  }

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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Pose Analysis</h1>
        </div>
        <Link href="/coach/video-analysis/upload" className="btn-primary flex items-center gap-1.5">
          <Upload size={16} strokeWidth={2} aria-hidden="true" />
          Upload Video
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Athlete filter (client component — needs onChange for navigation) */}
        <AthleteFilter
          athletes={athletes}
          currentAthleteId={searchParams.athleteId || ""}
          currentEvent={searchParams.event || ""}
        />

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

      {/* Summary — coaching intelligence brief */}
      {analyses.length > 0 && (
        <AnalysisSummary
          totalCount={analyses.length}
          completedCount={completedCount}
          eventCounts={eventCounts}
          latestInsight={latestInsight}
        />
      )}

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
