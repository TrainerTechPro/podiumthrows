import { requireAthleteSession, getAthleteVideos } from "@/lib/data/athlete";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventType } from "@/lib/utils";
import { formatTimestamp } from "@/components/video/types";

export const metadata = { title: "My Videos — Podium Throws" };

export default async function AthleteVideosPage() {
  let athlete;
  try {
    const session = await requireAthleteSession();
    athlete = session.athlete;
  } catch {
    redirect("/login");
  }

  const videos = await getAthleteVideos(athlete.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          My Videos
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {videos.length} video{videos.length !== 1 ? "s" : ""} shared with you
        </p>
      </div>

      {/* Grid */}
      {videos.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
          title="No videos yet"
          description="Videos shared by your coach will appear here. You'll be able to view technique analysis and annotations."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Link
              key={video.id}
              href={`/athlete/videos/${video.id}`}
              className="card group overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-surface-100 dark:bg-surface-800 overflow-hidden">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title ?? "Video thumbnail"}
                    loading="lazy"
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
                  {video.coachName && (
                    <span className="text-xs text-muted">
                      From {video.coachName}
                    </span>
                  )}
                  {video.event && (
                    <Badge variant="primary">
                      {formatEventType(video.event)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-surface-400">
                  {video.annotationCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                      </svg>
                      {video.annotationCount} annotation{video.annotationCount !== 1 ? "s" : ""}
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
