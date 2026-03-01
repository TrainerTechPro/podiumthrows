import { requireCoachSession, getCoachVideos, getCoachVideoStats } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Video } from "lucide-react";
import { VideoGrid } from "@/components/video/VideoGrid";

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
        <VideoGrid initialVideos={videos} />
      )}
    </div>
  );
}
