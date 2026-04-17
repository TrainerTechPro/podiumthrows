"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { CompetitionListCard } from "@/components/competitions/CompetitionListCard";
import type { MeetSummary, AthletePickerItem, CompetitionListRecord } from "@/lib/data/coach";
import { AddMeetModal } from "./_add-meet-modal";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  A: { label: "A Meet", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  B: { label: "B Meet", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  C: { label: "C Meet", color: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function isUpcoming(dateStr: string): boolean {
  return dateStr >= new Date().toISOString().split("T")[0];
}

/* ─── Meet Card ─────────────────────────────────────────────────────────── */

function MeetCard({ meet }: { meet: MeetSummary }) {
  const upcoming = isUpcoming(meet.date);
  const prio = PRIORITY_STYLES[meet.priority] || PRIORITY_STYLES.B;
  const fillRate = meet.totalEntries > 0 ? Math.round((meet.totalResults / meet.totalEntries) * 100) : 0;
  // Link to first entry's detail page; if multiple entries exist, show the grouped view via first id
  const firstEntryId = meet.entries[0]?.id;
  const href = firstEntryId ? `/coach/competitions/${firstEntryId}` : "#";

  return (
    <Link
      href={href}
      className="card card-interactive p-5 flex flex-col gap-3"
    >
      {/* Header */}
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
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${prio.color}`}>
            {prio.label}
          </span>
          {upcoming ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              Upcoming
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
              Past
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-muted">
          <Users size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="font-mono tabular-nums">
            <AnimatedNumber value={meet.totalEntries} />
          </span>
          {" "}entries
        </span>

        {!upcoming && (
          <span className="flex items-center gap-1.5 text-muted">
            {fillRate === 100 ? (
              <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" className="text-green-500" />
            ) : (
              <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            )}
            <span className="font-mono tabular-nums">{fillRate}%</span> results entered
          </span>
        )}
      </div>

      {/* Events */}
      <div className="flex flex-wrap gap-1.5">
        {meet.events.map((e) => (
          <Badge key={e} variant="neutral">
            {EVENT_LABELS[e] || e}
          </Badge>
        ))}
      </div>

      {/* Chevron */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400">
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
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

  const upcoming = initialMeets.filter((m) => isUpcoming(m.date));
  const past = initialMeets.filter((m) => !isUpcoming(m.date));

  return (
    <div className="space-y-8">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--foreground)]">
            Competitions
          </h1>
          <p className="text-sm text-muted mt-1">
            Schedule meets and enter results for your athletes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Add Meet
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {initialMeets.length === 0 && (
        <EmptyState
          icon={<Trophy size={40} strokeWidth={1.5} />}
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

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Upcoming Meets
          </h2>
          <StaggeredList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((m) => (
              <MeetCard key={`${m.name}::${m.date}`} meet={m} />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Past Meets
          </h2>
          <StaggeredList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((m) => (
              <MeetCard key={`${m.name}::${m.date}`} meet={m} />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* All Individual Competition Records */}
      {competitionList.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            All Competitions
          </h2>
          <StaggeredList className="grid gap-3">
            {competitionList.map((c) => (
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
        </section>
      )}

      {/* Add Meet Modal */}
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
