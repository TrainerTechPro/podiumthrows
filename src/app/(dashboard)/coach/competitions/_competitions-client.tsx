"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  ChevronRight,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { CompetitionListCard } from "@/components/competitions/CompetitionListCard";
import { useUrlStateMany } from "@/lib/hooks/useUrlState";
import type { MeetSummary, AthletePickerItem, CompetitionListRecord } from "@/lib/data/coach";
import { AddMeetModal } from "./_add-meet-modal";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  A: {
    label: "A Meet",
    color: "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400",
  },
  B: { label: "B Meet", color: "bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-400" },
  C: {
    label: "C Meet",
    color: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400",
  },
};

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All entries" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const EVENT_OPTIONS = [
  { key: "all", label: "All events" },
  { key: "SHOT_PUT", label: "Shot Put" },
  { key: "DISCUS", label: "Discus" },
  { key: "HAMMER", label: "Hammer" },
  { key: "JAVELIN", label: "Javelin" },
] as const;

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(dateStr: string): boolean {
  return dateStr >= new Date().toISOString().split("T")[0];
}

/* ─── Meet Card ─────────────────────────────────────────────────────────── */

function MeetCard({ meet }: { meet: MeetSummary }) {
  const upcoming = isUpcoming(meet.date);
  const prio = PRIORITY_STYLES[meet.priority] || PRIORITY_STYLES.B;
  const fillRate =
    meet.totalEntries > 0 ? Math.round((meet.totalResults / meet.totalEntries) * 100) : 0;
  const firstEntryId = meet.entries[0]?.id;
  const href = firstEntryId ? `/coach/competitions/${firstEntryId}` : "#";

  return (
    <Link href={href} className="card card-interactive p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-base font-semibold text-[var(--foreground)] truncate">
            {meet.name}
          </h3>
          <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
            <Calendar size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            {formatDate(meet.date)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-md text-micro font-semibold ${prio.color}`}>
            {prio.label}
          </span>
          {upcoming ? (
            <span className="px-2 py-0.5 rounded-md text-micro font-semibold bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">
              Upcoming
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-micro font-semibold bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
              Past
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="flex items-center gap-1.5 text-muted">
          <Users size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="font-mono tabular-nums">
            <AnimatedNumber value={meet.totalEntries} />
          </span>{" "}
          entries
        </span>

        {!upcoming && (
          <span className="flex items-center gap-1.5 text-muted">
            {fillRate === 100 ? (
              <CheckCircle2
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="text-success-500"
              />
            ) : (
              <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            )}
            <span className="font-mono tabular-nums">{fillRate}%</span> results entered
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {meet.events.map((e) => (
            <Badge key={e} variant="neutral">
              {EVENT_LABELS[e] || e}
            </Badge>
          ))}
        </div>
        <ChevronRight
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="text-surface-400 shrink-0"
        />
      </div>
    </Link>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */

export function CompetitionsClient({
  initialMeets,
  athletes,
  competitionList,
}: {
  initialMeets: MeetSummary[];
  athletes: AthletePickerItem[];
  competitionList: CompetitionListRecord[];
}) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const url = useUrlStateMany();

  /* All filter state in URL — sharable, refresh-safe, back-button-safe. */
  const tab: TabKey = (() => {
    const v = url.get("tab", "upcoming");
    return (TABS.map((t) => t.key) as readonly string[]).includes(v) ? (v as TabKey) : "upcoming";
  })();
  const setTab = (next: TabKey) => url.set({ tab: next === "upcoming" ? null : next });

  const eventFilter = (() => {
    const v = url.get("event", "all");
    return (EVENT_OPTIONS.map((e) => e.key) as readonly string[]).includes(v) ? v : "all";
  })();
  const setEventFilter = (next: string) => url.set({ event: next === "all" ? null : next });

  const query = url.get("q", "");
  const setQuery = (next: string) => url.set({ q: next || null });

  /* Filter pipelines */
  const meetMatches = (m: MeetSummary): boolean => {
    if (query.trim() && !m.name.toLowerCase().includes(query.toLowerCase().trim())) return false;
    if (eventFilter !== "all" && !m.events.includes(eventFilter as MeetSummary["events"][number]))
      return false;
    return true;
  };

  const upcoming = useMemo(
    () => initialMeets.filter((m) => isUpcoming(m.date)).filter(meetMatches),
    // meetMatches captures query+eventFilter; deps tracked explicitly below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialMeets, query, eventFilter]
  );
  const past = useMemo(
    () => initialMeets.filter((m) => !isUpcoming(m.date)).filter(meetMatches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialMeets, query, eventFilter]
  );
  const allEntries = useMemo(
    () =>
      competitionList.filter((c) => {
        if (query.trim() && !c.name.toLowerCase().includes(query.toLowerCase().trim()))
          return false;
        if (eventFilter !== "all" && c.event !== eventFilter) return false;
        return true;
      }),
    [competitionList, query, eventFilter]
  );

  const tabCounts: Record<TabKey, number> = {
    upcoming: initialMeets.filter((m) => isUpcoming(m.date) && meetMatches(m)).length,
    past: initialMeets.filter((m) => !isUpcoming(m.date) && meetMatches(m)).length,
    all: allEntries.length,
  };

  const isFilterActive = query.trim().length > 0 || eventFilter !== "all";
  const totalMeets = initialMeets.length;

  return (
    <div className="space-y-6">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--foreground)]">Competitions</h1>
          <p className="text-sm text-muted mt-1">
            Schedule meets and enter results for your athletes
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Add Meet
        </Button>
      </div>

      {/* Filter bar — search + event */}
      {totalMeets > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={16}
              strokeWidth={1.75}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search meets…"
              className="input pl-9"
              aria-label="Search meets"
            />
          </div>

          {/* Event chips */}
          <div
            role="tablist"
            aria-label="Filter by event"
            className="flex items-center gap-1.5 flex-wrap"
          >
            {EVENT_OPTIONS.map((opt) => {
              const active = eventFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEventFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary-500 text-surface-950"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state — no meets at all */}
      {totalMeets === 0 && (
        <EmptyState
          icon={<Trophy size={40} strokeWidth={1.75} />}
          title="No competitions yet"
          description="Schedule upcoming meets and track your athletes' competition results all in one place."
          action={
            <Button onClick={() => setShowAddModal(true)}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add First Meet
            </Button>
          }
        />
      )}

      {/* Tabs */}
      {totalMeets > 0 && (
        <>
          <div
            role="tablist"
            aria-label="Competition view"
            className="flex items-center gap-1 border-b border-[var(--card-border)] overflow-x-auto custom-scrollbar"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`relative shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 text-xs text-muted tabular-nums">{tabCounts[t.key]}</span>
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          <section>
            {tab === "upcoming" &&
              (upcoming.length > 0 ? (
                <StaggeredList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((m) => (
                    <MeetCard key={`${m.name}::${m.date}`} meet={m} />
                  ))}
                </StaggeredList>
              ) : (
                <EmptyState
                  compact
                  title={isFilterActive ? "No upcoming meets match" : "No upcoming meets"}
                  description={
                    isFilterActive
                      ? "Try clearing the search or event filter."
                      : "Schedule your next meet to see it here."
                  }
                  action={
                    isFilterActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setEventFilter("all");
                        }}
                        className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Clear filters
                      </button>
                    ) : (
                      <Button onClick={() => setShowAddModal(true)} size="sm">
                        <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                        Add Meet
                      </Button>
                    )
                  }
                />
              ))}

            {tab === "past" &&
              (past.length > 0 ? (
                <StaggeredList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((m) => (
                    <MeetCard key={`${m.name}::${m.date}`} meet={m} />
                  ))}
                </StaggeredList>
              ) : (
                <EmptyState
                  compact
                  title={isFilterActive ? "No past meets match" : "No past meets"}
                  description={
                    isFilterActive
                      ? "Try clearing the search or event filter."
                      : "Completed meets will appear here."
                  }
                />
              ))}

            {tab === "all" &&
              (allEntries.length > 0 ? (
                <StaggeredList className="grid gap-3">
                  {allEntries.map((c) => (
                    <CompetitionListCard
                      key={c.id}
                      item={{
                        id: c.id,
                        name: c.name,
                        date: c.date,
                        event: c.event,
                        placeFinish: c.placeFinish ?? null,
                        meetStatus: c.meetStatus ?? null,
                        venueType: c.venueType ?? null,
                        bestMark: c.bestMark ?? null,
                        throwCount: c.throwCount ?? 0,
                      }}
                      href={`/coach/competitions/${c.id}`}
                    />
                  ))}
                </StaggeredList>
              ) : (
                <EmptyState
                  compact
                  title={isFilterActive ? "No entries match" : "No competition entries yet"}
                  description={
                    isFilterActive
                      ? "Try clearing the search or event filter."
                      : "Individual athlete entries will appear once meets are logged."
                  }
                />
              ))}
          </section>
        </>
      )}

      {showAddModal && (
        <AddMeetModal
          athletes={athletes}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
