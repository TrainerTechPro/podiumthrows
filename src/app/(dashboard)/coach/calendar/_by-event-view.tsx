"use client";

import { useEffect, useState } from "react";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Layers } from "lucide-react";
import { CalendarView } from "./_calendar-view";
import { logger } from "@/lib/logger";

/**
 * By-Event view: same week calendar, but the coach picks one event group
 * up front and the calendar filters to that group's sessions only.
 *
 * The coach is throwing four events on a roster — they need to look at
 * shot put programming WITHOUT discus + hammer + javelin sessions polluting
 * the grid. A pill row inside CalendarView lets them flip "All / Group /
 * Unassigned" inline; this tab makes group-first the deliberate frame.
 */
export function ByEventView() {
  const [groups, setGroups] = useState<EventGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach/event-groups")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = (json.data ?? []) as EventGroupItem[];
        setGroups(list);
        if (list.length > 0) setSelectedGroupId(list[0].id);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("[calendar/by-event] groups fetch error", { error: err });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-72 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="card text-center py-12 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto">
          <Layers size={24} className="text-primary-500" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-[var(--foreground)] text-sm">No event groups yet</p>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Split your roster by event so you can program shot put without discus noise in the way.
          </p>
        </div>
        <a href="/coach/event-groups" className="btn-primary inline-flex text-sm px-4 py-2 mx-auto">
          Manage event groups
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Viewing</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {groups.map((g) => {
            const isActive = g.id === selectedGroupId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupId(g.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary-500 text-white shadow-sm"
                    : "bg-[var(--muted-bg)] text-muted hover:text-[var(--foreground)]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: g.color || "var(--color-brand)" }}
                  aria-hidden="true"
                />
                {g.name}
              </button>
            );
          })}
        </div>
      </div>

      <CalendarView hideGroupPills forcedGroupId={selectedGroupId} />
    </div>
  );
}
