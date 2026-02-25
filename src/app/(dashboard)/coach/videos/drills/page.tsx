import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventType } from "@/lib/utils";

export const metadata = { title: "Drill Videos — Podium Throws" };

const CATEGORY_LABELS: Record<string, string> = {
  CE: "Competitive Exercise",
  SDE: "Special Developmental",
  SPE: "Special Preparatory",
  GPE: "General Preparatory",
};

const DIFFICULTY_VARIANTS: Record<string, "success" | "warning" | "danger"> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "danger",
};

type SearchParams = {
  event?: string;
  category?: string;
  difficulty?: string;
};

export default async function DrillVideoLibraryPage({
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

  // Fetch drills that have videos
  const where: Record<string, unknown> = {
    videoUrl: { not: null },
    OR: [{ coachId: coach.id }, { isGlobal: true }],
  };

  if (searchParams.event) where.event = searchParams.event;
  if (searchParams.category) where.category = searchParams.category;
  if (searchParams.difficulty) where.difficulty = searchParams.difficulty;

  const drills = await prisma.drill.findMany({
    where,
    orderBy: { name: "asc" },
  });

  const events = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
  const categories = ["CE", "SDE", "SPE", "GPE"];
  const difficulties = ["beginner", "intermediate", "advanced"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/coach/videos"
            className="text-sm text-muted hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Video Library
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Drill Videos
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {drills.length} drill{drills.length !== 1 ? "s" : ""} with video demonstrations
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Event pills */}
        <Link
          href="/coach/videos/drills"
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !searchParams.event
              ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
              : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
          }`}
        >
          All Events
        </Link>
        {events.map((ev) => {
          const params = new URLSearchParams();
          params.set("event", ev);
          if (searchParams.category) params.set("category", searchParams.category);
          if (searchParams.difficulty) params.set("difficulty", searchParams.difficulty);
          return (
            <Link
              key={ev}
              href={`/coach/videos/drills?${params}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                searchParams.event === ev
                  ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {formatEventType(ev)}
            </Link>
          );
        })}
      </div>

      {/* Grid */}
      {drills.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
          title="No drill videos found"
          description="Drills with attached video URLs will appear here. Add video URLs to your drills to build the library."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drills.map((drill) => (
            <div
              key={drill.id}
              className="card overflow-hidden group"
            >
              {/* Video thumbnail area */}
              <div className="relative aspect-video bg-surface-100 dark:bg-surface-800">
                {/* We just show a video icon since drills store external URLs */}
                <div className="flex items-center justify-center h-full text-surface-400">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>

                {/* Play overlay */}
                {drill.videoUrl && (
                  <a
                    href={drill.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-surface-900 ml-0.5">
                        <polygon points="5 3 19 12 5 21" />
                      </svg>
                    </div>
                  </a>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {drill.name}
                </h3>
                {drill.description && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">
                    {drill.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {drill.event && (
                    <Badge variant="primary">
                      {formatEventType(drill.event)}
                    </Badge>
                  )}
                  <Badge variant="info">
                    {CATEGORY_LABELS[drill.category] ?? drill.category}
                  </Badge>
                  {drill.difficulty && (
                    <Badge variant={DIFFICULTY_VARIANTS[drill.difficulty] ?? "neutral"}>
                      {drill.difficulty.charAt(0).toUpperCase() + drill.difficulty.slice(1)}
                    </Badge>
                  )}
                </div>
                {drill.cues.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-medium text-surface-400 uppercase tracking-wider mb-0.5">
                      Cues
                    </p>
                    <ul className="text-[10px] text-surface-500 space-y-0.5">
                      {drill.cues.slice(0, 3).map((cue, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-primary-500 mt-px">•</span>
                          <span>{cue}</span>
                        </li>
                      ))}
                      {drill.cues.length > 3 && (
                        <li className="text-surface-400">
                          +{drill.cues.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
