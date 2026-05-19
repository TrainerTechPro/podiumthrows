import {
  requireCoachSession,
  getCoachVideos,
  getCoachVideoStats,
  type VideoStats,
} from "@/lib/data/coach";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Video, Upload, Search as SearchIcon } from "lucide-react";
import { VideoGrid } from "@/components/video/VideoGrid";

export const metadata = { title: "Video Library — Podium Throws" };

type SearchParams = {
  event?: string;
  category?: string;
  search?: string;
};

export default async function VideoLibraryPage({ searchParams }: { searchParams: SearchParams }) {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  const [videosResult, statsResult] = await Promise.allSettled([
    getCoachVideos(coach.id, {
      event: searchParams.event,
      category: searchParams.category,
      search: searchParams.search,
    }),
    getCoachVideoStats(coach.id),
  ]);

  const videos = videosResult.status === "fulfilled" ? videosResult.value : [];
  const stats: VideoStats =
    statsResult.status === "fulfilled"
      ? statsResult.value
      : { total: 0, byEvent: {}, recentCount: 0 };

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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Video Library</h1>
          <p className="text-sm text-muted mt-0.5">
            {stats.total} video{stats.total !== 1 ? "s" : ""} · {stats.recentCount} uploaded this
            week
          </p>
        </div>
        <Link href="/coach/videos/upload" className="btn-primary">
          <Upload size={16} strokeWidth={1.75} className="mr-1.5" aria-hidden="true" />
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
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                  : "text-surface-500 dark:text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
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
          {searchParams.event && <input type="hidden" name="event" value={searchParams.event} />}
          <input
            type="text"
            name="search"
            defaultValue={searchParams.search}
            placeholder="Search videos…"
            className="input text-sm pl-8 w-48 sm:w-56"
          />
          <SearchIcon
            size={14}
            strokeWidth={1.75}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400"
            aria-hidden="true"
          />
        </form>
      </div>

      {/* Video Grid */}
      {videos.length === 0 ? (
        <EmptyState
          icon={<Video size={24} strokeWidth={1.75} aria-hidden="true" />}
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
        <VideoGrid initialVideos={videos} />
      )}
    </div>
  );
}
