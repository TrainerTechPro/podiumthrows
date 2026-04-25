"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Dumbbell, Library, BookOpen, ArrowRight } from "lucide-react";
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

export function AllTab({ plans, exercises, drills, onTabChange }: AllTabProps) {
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
          href: `#`,
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
          href: `#`,
        });
      }
    }
    return results.slice(0, 30);
  }, [trimmed, isSearching, plans, exercises, drills]);

  const sections = [
    {
      id: "sessions",
      title: "Sessions",
      description: "Reusable throws session templates with blocks and drills.",
      icon: BookOpen,
      count: null,
      hint: "Open Sessions →",
    },
    {
      id: "plans",
      title: "Plans",
      description: "Multi-week training plans assignable to athletes.",
      icon: FileText,
      count: plans.length,
      hint: "Browse Plans →",
    },
    {
      id: "exercises",
      title: "Exercises",
      description: "Strength and conditioning movements with system + custom entries.",
      icon: Dumbbell,
      count: exercises.length,
      hint: "Browse Exercises →",
    },
    {
      id: "drills",
      title: "Drills",
      description: "Throws-specific drills, cards and video demonstrations.",
      icon: Library,
      count: drills.length,
      hint: "Browse Drills →",
    },
  ] as const;

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
        />
      </div>

      {isSearching ? (
        hits.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-muted">No matches for &ldquo;{query}&rdquo;.</p>
            <p className="text-xs text-muted mt-1">
              Sessions are searched on the Sessions tab — try there if your query is a session name.
            </p>
          </div>
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 shrink-0">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                className="card card-interactive !p-5 text-left flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
                  <Icon
                    size={20}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="text-primary-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">{s.title}</h3>
                    {s.count !== null && (
                      <span className="text-xs font-mono tabular-nums text-muted">{s.count}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">{s.description}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">
                    {s.hint}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
