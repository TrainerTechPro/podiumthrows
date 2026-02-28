import { requireCoachSession, getCoachVideos, getCoachVideoStats } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventType } from "@/lib/utils";
import { formatTimestamp } from "@/components/video/types";
import { Video } from "lucide-react";

export const metadata = { title: "Video Library — Podium Throws" };

type SearchParams = {
  event?: string;
  category?: string;
  search?: string;
};

export default async function VideoLibraryPage({
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

  const [videos, stats] = await Promise.all([
    getCoachVideos(coach.id, {
      event: searchParams.event,
      category: searchParams.category,
      search: searchParams.search,
    }),
    getCoachVideoStats(coach.id),
  ]);

  const categories = [
    { label: "All", value: "" },
    { label: "Training", value: "training" },
    { label: "Competition", value: "competition" },
    { label: "Drill", value: "drill" },
    { label: "Analysis", value: "analysis" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Video Library
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {stats.total} video{stats.total !== 1 ? "s" : ""} ·{" "}
            {stats.recentCount} uploaded this week
          </p>
        </div>
        <Link href="/coach/videos/upload" className="btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Video
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category pills */}
        {categories.map((cat) => {
          const isActive = (searchParams.category ?? "") === cat.value;
          const params = new URLSearchParams();
          if (cat.value) params.set("category", cat.value);
          if (searchParams.event) params.set("event", searchParams.event);
          if (searchParams.search) params.set("search", searchParams.search);
          const href = `/coach/videos${params.toString() ? `?${params}` : ""}`;

          return (
            <Link
              key={cat.value}
              href={href}
              className={`px-3 py-2.5 rounded-full text-xs font-medium transition-colors inline-flex items-center justify-center min-h-[44px] min-w-[44px] ${
                isActive
                  ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {cat.label}
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* Search */}
        <form action="/coach/videos" method="GET" className="relative">
          {searchParams.category && (
            <input type="hidden" name="category" value={searchParams.category} />
          )}
          {searchParams.event && (
            <input type="hidden" name="event" value={searchParams.event} />
          )}
          <input
            type="text"
            name="search"
            defaultValue={searchParams.search}
            placeholder="Search videos…"
            className="input text-sm pl-8 w-48 sm:w-56"
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </form>
      </div>

      {/* Video Grid */}
      {videos.length === 0 ? (
        <EmptyState
          icon={<Video size={24} strokeWidth={1.5} aria-hidden="true" />}
          title={searchParams.search ? `No results for "${searchParams.search}"` : "No videos yet"}
          description={
            searchParams.search
              ? "Try different keywords or clear your filters."
              : "Upload your first video to start analyzing technique and sharing feedback."
          }
          action={
            !searchParams.search && (
              <Link href="/coach/videos/upload" className="btn-primary">
                Upload Video
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Link
              key={video.id}
              href={`/coach/videos/${video.id}`}
              className="card group overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-surface-100 dark:bg-surface-800 overflow-hidden">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title ?? "Video thumbnail"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-surface-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                )}

                {/* Duration badge */}
                {video.durationSec && (
                  <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded">
                    {formatTimestamp(video.durationSec)}
                  </span>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-surface-900 ml-0.5">
                      <polygon points="5 3 19 12 5 21" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)] truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {video.title ?? "Untitled Video"}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {video.athleteName && (
                    <span className="text-xs text-muted truncate">
                      {video.athleteName}
                    </span>
                  )}
                  {video.event && (
                    <Badge variant="primary">
                      {formatEventType(video.event)}
                    </Badge>
                  )}
                  {video.category && (
                    <Badge variant="neutral">
                      {video.category.charAt(0).toUpperCase() + video.category.slice(1)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-surface-400">
                  {video.annotationCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                      </svg>
                      {video.annotationCount}
                    </span>
                  )}
                  <span>
                    {new Date(video.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
