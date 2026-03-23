import Link from "next/link";
import { Video, Play } from "lucide-react";
import type { VideoItem } from "@/lib/data/dashboard";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ─── Widget ───────────────────────────────────────────────────────────── */

export function RecentVideosWidget({ videos }: { videos: VideoItem[] }) {
  return (
    <div className="card px-4 py-4 sm:px-5 shadow-sm md:hover:shadow-md md:transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Recent Videos
        </h3>
        <Link
          href="/athlete/videos"
          className="text-xs text-primary-500 hover:underline"
        >
          View all &gt;
        </Link>
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <Video
              size={20}
              strokeWidth={1.75}
              className="text-surface-400 dark:text-surface-500"
              aria-hidden="true"
            />
          </div>
          <div className="max-w-[220px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              No videos shared yet
            </p>
            <p className="text-xs text-muted mt-1">
              Videos from your coach or self-uploads will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {videos.map((video) => (
            <Link
              key={video.id}
              href={`/athlete/videos/${video.id}`}
              className="group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title ?? "Video thumbnail"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video
                      size={24}
                      strokeWidth={1.75}
                      className="text-surface-400 dark:text-surface-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play
                      size={14}
                      strokeWidth={1.75}
                      className="text-surface-900 ml-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
              {/* Title + date */}
              <p className="text-xs font-medium text-[var(--foreground)] mt-1.5 truncate">
                {video.title ?? "Untitled Video"}
              </p>
              <p className="text-[10px] text-muted">
                {formatDate(video.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
