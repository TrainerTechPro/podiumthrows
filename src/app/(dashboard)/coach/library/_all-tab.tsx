"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { formatEventType } from "@/lib/utils";
import type { ExerciseItem, WorkoutPlanItem, DrillItem } from "@/lib/data/coach";

interface AllTabProps {
  plans: WorkoutPlanItem[];
  exercises: ExerciseItem[];
  drills: DrillItem[];
  onTabChange: (id: string) => void;
}

interface SearchHit {
  id: string;
  type: "plan" | "exercise" | "drill";
  title: string;
  subtitle: string;
  href: string;
}

export function AllTab({ plans, exercises, drills, onTabChange: _onTabChange }: AllTabProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  const hits = useMemo<SearchHit[]>(() => {
    if (!isSearching) return [];
    const results: SearchHit[] = [];
    for (const p of plans) {
      if (p.name.toLowerCase().includes(trimmed)) {
        const total = p.programmedSessionCount + p.sessionCount;
        results.push({
          id: p.id,
          type: "plan",
          title: p.name,
          subtitle: `${total} session${total !== 1 ? "s" : ""}`,
          href: `/coach/plans/${p.id}`,
        });
      }
    }
    for (const e of exercises) {
      if (e.name.toLowerCase().includes(trimmed)) {
        results.push({
          id: e.id,
          type: "exercise",
          title: e.name,
          subtitle: e.category ?? "Exercise",
          href: `/coach/exercises`,
        });
      }
    }
    for (const d of drills) {
      if (
        d.name.toLowerCase().includes(trimmed) ||
        (d.description ?? "").toLowerCase().includes(trimmed)
      ) {
        results.push({
          id: d.id,
          type: "drill",
          title: d.name,
          subtitle: d.event ? formatEventType(d.event) : "Drill",
          href: `/coach/throws/drills?focus=${d.id}`,
        });
      }
    }
    return results.slice(0, 30);
  }, [trimmed, isSearching, plans, exercises, drills]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions, plans, exercises, drills…"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)] focus:border-primary-500/30"
          aria-label="Search library"
          autoFocus
        />
      </div>

      {isSearching ? (
        hits.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">
            No matches for &ldquo;{query}&rdquo;. Sessions are searched on the Sessions tab — try
            there if your query is a session name.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              {hits.length} match{hits.length !== 1 ? "es" : ""}
            </p>
            <ul className="space-y-2">
              {hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  <Link
                    href={h.href}
                    className="card card-interactive !p-3 flex items-center gap-3"
                  >
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-nano font-bold uppercase tracking-wider bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 shrink-0">
                      {h.type}
                    </span>
                    <span className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {h.title}
                      </p>
                      <p className="text-xs text-muted truncate">{h.subtitle}</p>
                    </span>
                    <ArrowRight
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="text-muted shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <p className="text-sm text-muted text-center py-10">
          Search across plans, exercises, and drills — or open a tab above. Hit ⌘K for the full
          command palette.
        </p>
      )}
    </div>
  );
}
