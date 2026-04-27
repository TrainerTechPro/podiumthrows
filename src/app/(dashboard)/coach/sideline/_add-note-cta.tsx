"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, Search, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import type { SidelineRosterAthlete } from "@/lib/data/sideline";

export function AddNoteCTA({ roster }: { roster: SidelineRosterAthlete[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q));
  }, [roster, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-4 rounded-2xl p-5 bg-primary-500 text-surface-950 active:scale-[0.98] transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        disabled={roster.length === 0}
      >
        <div className="flex items-center gap-3 text-left">
          <span className="rounded-full bg-surface-950/10 p-2.5">
            <MessageSquarePlus size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-bold">Add note or video</p>
            <p className="text-xs font-medium opacity-80">
              Capture an observation while it&apos;s fresh
            </p>
          </div>
        </div>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        side="bottom"
        size="lg"
        title="Choose an athlete"
        description="The note composer opens on the athlete's profile."
      >
        <div className="space-y-3">
          <label className="relative block">
            <Search
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roster"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </label>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
              No athletes match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--card-border)]/40">
              {filtered.map((a) => (
                <li key={a.athleteId}>
                  <Link
                    href={`/coach/athletes/${a.athleteId}#add-note`}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <Avatar name={`${a.firstName} ${a.lastName}`} src={a.avatarUrl} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {a.firstName} {a.lastName}
                      </p>
                      {a.events.length > 0 && (
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">
                          {a.events.join(" · ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      style={{ color: "var(--color-text-secondary)" }}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}
