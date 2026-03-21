"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ProgrammedSessionWithDetails, SessionTier } from "@/lib/data/programming";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Button } from "@/components";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { Tabs, TabList, TabTrigger } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { WeekCalendar } from "./_week-calendar";
import { SessionSidebar } from "./_session-sidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Get the Monday of the week containing `d`. */
function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Format a Date as YYYY-MM-DD in local time. */
function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Add/subtract days from a date, returning a new Date. */
function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/** Format the week label: "Week of Mar 17" */
function formatWeekLabel(monday: Date): string {
  const month = monday.toLocaleDateString("en-US", { month: "short" });
  return `Week of ${month} ${monday.getDate()}`;
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function ProgrammingPage() {
  /* ── State ─────────────────────────────────────────────────────────── */
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [sessions, setSessions] = useState<ProgrammedSessionWithDetails[]>([]);
  const [groups, setGroups] = useState<EventGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);

  // Sidebar state
  const [sidebarSession, setSidebarSession] = useState<ProgrammedSessionWithDetails | null>(null);
  const [sidebarDate, setSidebarDate] = useState<string | null>(null);

  /* ── Derived ───────────────────────────────────────────────────────── */
  const isCurrentWeek = useMemo(() => {
    const today = getMonday(new Date());
    return toDateStr(weekStart) === toDateStr(today);
  }, [weekStart]);

  /* ── Fetchers ──────────────────────────────────────────────────────── */
  const fetchSessions = useCallback(async (start: Date) => {
    try {
      const startStr = toDateStr(start);
      const endStr = toDateStr(addDays(start, 6));
      const res = await fetch(`/api/coach/programming?start=${startStr}&end=${endStr}`);
      if (!res.ok) throw new Error("Failed to load sessions");
      const json = await res.json();
      setSessions(json.data ?? []);
    } catch (err) {
      console.error("[programming] fetch sessions error:", err);
      setSessions([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/event-groups");
      if (!res.ok) throw new Error("Failed to load groups");
      const json = await res.json();
      setGroups(json.data ?? []);
    } catch (err) {
      console.error("[programming] fetch groups error:", err);
    }
  }, []);

  /* ── Effects ───────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    setLoading(true);
    fetchSessions(weekStart).finally(() => setLoading(false));
  }, [weekStart, fetchSessions]);

  /* ── Navigation handlers ───────────────────────────────────────────── */
  const goToPrevWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, -7));
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, 7));
  }, []);

  const goToToday = useCallback(() => {
    setWeekStart(getMonday(new Date()));
  }, []);

  /* ── Calendar interaction handlers ─────────────────────────────────── */
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
    // Refetch sessions so the calendar reflects any changes
    fetchSessions(weekStart);
  }, [fetchSessions, weekStart]);

  /* ── Tab change handler ────────────────────────────────────────────── */
  const handleTabChange = useCallback((tabId: string) => {
    if (tabId === "all") {
      setActiveGroupFilter(null);
    } else if (tabId === "unassigned") {
      setActiveGroupFilter("unassigned");
    } else {
      setActiveGroupFilter(tabId);
    }
  }, []);

  /* ── Compute active tab id from filter state ───────────────────────── */
  const activeTabId = activeGroupFilter === null ? "all" : activeGroupFilter;

  /* ── Loading skeleton ──────────────────────────────────────────────── */
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

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      <ScrollProgressBar />

      {/* Header — week navigator */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPrevWeek} aria-label="Previous week">
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>

          <h1 className="text-lg sm:text-xl font-heading font-bold text-[var(--foreground)] whitespace-nowrap">
            {formatWeekLabel(weekStart)}
          </h1>

          <Button variant="ghost" size="sm" onClick={goToNextWeek} aria-label="Next week">
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>

        {!isCurrentWeek && (
          <button
            type="button"
            onClick={goToToday}
            className="text-sm text-primary-500 hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded"
          >
            Today
          </button>
        )}
      </div>

      {/* Filter tabs — groups */}
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
                  style={{ backgroundColor: g.color || "#f59e0b" }}
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

      {/* Calendar grid */}
      {loading ? (
        renderSkeleton()
      ) : (
        <WeekCalendar
          sessions={sessions}
          weekStart={weekStart}
          onClickDay={handleClickDay}
          onClickSession={handleClickSession}
          filterGroupId={activeGroupFilter}
        />
      )}

      {/* Session create/edit sidebar */}
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
