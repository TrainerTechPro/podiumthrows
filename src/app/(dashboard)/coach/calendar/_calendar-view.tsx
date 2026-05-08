"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ProgrammedSessionWithDetails, SessionTier } from "@/lib/data/programming";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Button } from "@/components";
import { Tabs, TabList, TabTrigger } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { WeekCalendar, type CompetitionMarker } from "../schedule/_week-calendar";
import { SessionSidebar } from "../schedule/_session-sidebar";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";

function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function formatWeekLabel(monday: Date): string {
  const month = monday.toLocaleDateString("en-US", { month: "short" });
  return `Week of ${month} ${monday.getDate()}`;
}

interface CalendarViewProps {
  /** When true, the group filter pill row is hidden (consumer renders it differently — e.g. By Event tab). */
  hideGroupPills?: boolean;
  /** When set, locks the view to this group id (used by By Event tab). */
  forcedGroupId?: string | null;
  /** Customize the print href base. Calendar absorbed schedule's URL space, so the print page now lives at /coach/calendar/print. */
  printHrefBase?: string;
}

export function CalendarView({
  hideGroupPills = false,
  forcedGroupId = null,
  printHrefBase = "/coach/calendar/print",
}: CalendarViewProps = {}) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [sessions, setSessions] = useState<ProgrammedSessionWithDetails[]>([]);
  const [groups, setGroups] = useState<EventGroupItem[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(forcedGroupId);

  const [sidebarSession, setSidebarSession] = useState<ProgrammedSessionWithDetails | null>(null);
  const [sidebarDate, setSidebarDate] = useState<string | null>(null);

  // Sync forced group when parent changes it
  useEffect(() => {
    if (forcedGroupId !== undefined) {
      setActiveGroupFilter(forcedGroupId);
    }
  }, [forcedGroupId]);

  const isCurrentWeek = useMemo(() => {
    const today = getMonday(new Date());
    return toDateStr(weekStart) === toDateStr(today);
  }, [weekStart]);

  const fetchSessions = useCallback(async (start: Date) => {
    try {
      const startStr = toDateStr(start);
      const endStr = toDateStr(addDays(start, 6));
      const res = await fetch(`/api/coach/programming?start=${startStr}&end=${endStr}`);
      if (!res.ok) throw new Error("Failed to load sessions");
      const json = await res.json();
      setSessions(json.data ?? []);
    } catch (err) {
      logger.error("[calendar] fetch sessions error:", {
        context: "coach/calendar",
        error: err,
      });
      setSessions([]);
    }
  }, []);

  const fetchCompetitions = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/competitions?filter=upcoming");
      if (!res.ok) throw new Error("Failed to load competitions");
      const json = await res.json();
      type MeetEntry = { id: string; athleteId: string; athleteName: string; event: string };
      type Meet = { name: string; date: string; priority: string; entries: MeetEntry[] };
      const meets = (json.data ?? []) as Meet[];
      const flat: CompetitionMarker[] = meets.flatMap((m) =>
        m.entries.map((e) => ({
          id: e.id,
          date: m.date,
          meetName: m.name,
          priority: m.priority,
          athleteId: e.athleteId,
          athleteName: e.athleteName,
          event: e.event,
        }))
      );
      setCompetitions(flat);
    } catch (err) {
      logger.error("[calendar] fetch competitions error:", {
        context: "coach/calendar",
        error: err,
      });
      setCompetitions([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/event-groups");
      if (!res.ok) throw new Error("Failed to load groups");
      const json = await res.json();
      setGroups(json.data ?? []);
    } catch (err) {
      logger.error("[calendar] fetch groups error:", { context: "coach/calendar", error: err });
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchCompetitions();
  }, [fetchGroups, fetchCompetitions]);

  useEffect(() => {
    setLoading(true);
    fetchSessions(weekStart).finally(() => setLoading(false));
  }, [weekStart, fetchSessions]);

  const goToPrevWeek = useCallback(() => setWeekStart((p) => addDays(p, -7)), []);
  const goToNextWeek = useCallback(() => setWeekStart((p) => addDays(p, 7)), []);
  const goToToday = useCallback(() => setWeekStart(getMonday(new Date())), []);

  const handleClickDay = useCallback((date: string) => {
    setSidebarSession(null);
    setSidebarDate(date);
  }, []);

  const handleClickSession = useCallback((session: ProgrammedSessionWithDetails) => {
    setSidebarDate(null);
    setSidebarSession(session);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarSession(null);
    setSidebarDate(null);
    fetchSessions(weekStart);
  }, [fetchSessions, weekStart]);

  const handleTabChange = useCallback((tabId: string) => {
    if (tabId === "all") setActiveGroupFilter(null);
    else if (tabId === "unassigned") setActiveGroupFilter("unassigned");
    else setActiveGroupFilter(tabId);
  }, []);

  const activeTabId = activeGroupFilter === null ? "all" : activeGroupFilter;

  const renderSkeleton = () => (
    <div className="overflow-x-auto custom-scrollbar -mx-1 px-1">
      <div className="grid grid-cols-7 gap-2 min-w-[980px] md:min-w-0">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-[var(--card-border)] min-h-[160px]"
          >
            <div className="px-2.5 py-2 border-b border-[var(--card-border)]">
              <Skeleton className="h-3.5 w-12" />
            </div>
            <div className="flex-1 p-1.5 space-y-1.5">
              {i % 3 !== 2 && <Skeleton className="h-16 rounded-xl" />}
              {i % 2 === 0 && <Skeleton className="h-16 rounded-xl" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPrevWeek} aria-label="Previous week">
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>

          <h2 className="text-lg sm:text-xl font-heading font-bold text-[var(--foreground)] whitespace-nowrap">
            <time dateTime={toDateStr(weekStart)}>{formatWeekLabel(weekStart)}</time>
          </h2>

          <Button variant="ghost" size="sm" onClick={goToNextWeek} aria-label="Next week">
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goToToday}
              className="text-sm text-primary-500 hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded"
            >
              Today
            </button>
          )}

          <Link
            href={`${printHrefBase}?start=${toDateStr(weekStart)}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-[var(--foreground)] border border-[var(--card-border)] hover:border-primary-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            aria-label="Print this week's program"
          >
            <Printer size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Print Week</span>
          </Link>
        </div>
      </div>

      {!hideGroupPills && (
        <Tabs defaultTab="all" activeTab={activeTabId} onChange={handleTabChange}>
          <TabList variant="pills" className="pb-1">
            <TabTrigger id="all" variant="pills">
              All
            </TabTrigger>
            {groups.map((g) => (
              <TabTrigger key={g.id} id={g.id} variant="pills">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: g.color || "var(--color-brand)" }}
                    aria-hidden="true"
                  />
                  {g.name}
                </span>
              </TabTrigger>
            ))}
            <TabTrigger id="unassigned" variant="pills">
              Unassigned
            </TabTrigger>
          </TabList>
        </Tabs>
      )}

      {loading ? (
        renderSkeleton()
      ) : (
        <WeekCalendar
          sessions={sessions}
          competitions={competitions}
          weekStart={weekStart}
          onClickDay={handleClickDay}
          onClickSession={handleClickSession}
          filterGroupId={activeGroupFilter}
        />
      )}

      {(sidebarSession || sidebarDate) && (
        <SessionSidebar
          mode={sidebarSession ? "edit" : "create"}
          session={sidebarSession}
          date={sidebarDate}
          tier={
            (sidebarSession?.tier as SessionTier) ??
            (activeGroupFilter && activeGroupFilter !== "unassigned"
              ? "GROUP"
              : activeGroupFilter === "unassigned"
                ? "INDIVIDUAL"
                : "TEAM")
          }
          groupId={
            sidebarSession?.group?.id ??
            (activeGroupFilter && activeGroupFilter !== "unassigned" ? activeGroupFilter : null)
          }
          groups={groups}
          onClose={closeSidebar}
          onSaved={closeSidebar}
        />
      )}
    </div>
  );
}
