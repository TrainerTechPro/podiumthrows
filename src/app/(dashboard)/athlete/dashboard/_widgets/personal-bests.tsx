import Link from "next/link";
import { Award, Star } from "lucide-react";
import { AnimatedNumber } from "@/components";
import type { PRItem } from "@/lib/data/dashboard";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ─── Widget ───────────────────────────────────────────────────────────── */

export function PersonalBestsWidget({ prs }: { prs: PRItem[] }) {
  return (
    <div className="card py-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Personal Bests
        </h3>
        <Link
          href="/athlete/throws"
          className="text-xs text-primary-500 hover:underline"
        >
          History &gt;
        </Link>
      </div>

      {prs.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            <Star
              size={20}
              strokeWidth={1.75}
              className="text-primary-500"
              aria-hidden="true"
            />
          </div>
          <div className="max-w-[220px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              No personal bests yet
            </p>
            <p className="text-xs text-muted mt-1">
              Once you log throws, your best marks will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {prs.map((pr) => (
            <div key={pr.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Award
                  size={14}
                  strokeWidth={1.75}
                  className="text-amber-500"
                  aria-hidden="true"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {formatEventName(pr.event)}
                </p>
                <p className="text-xs text-muted">
                  {formatRelativeDate(pr.date)}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
                <AnimatedNumber value={pr.distance} decimals={2} />m
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
