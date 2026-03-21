"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Avatar, Badge, Button } from "@/components";
import { Skeleton } from "@/components/ui/Skeleton";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ────────────────────────────────────────────────────────────── */

interface RosterAthlete {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
}

interface MemberManagerProps {
  group: EventGroupItem;
  onUpdated: () => void;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

/* ─── Component ────────────────────────────────────────────────────────── */

export function MemberManager({ group, onUpdated }: MemberManagerProps) {
  const [roster, setRoster] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Fetch full roster
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/coach/athletes")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load roster");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const athletes: RosterAthlete[] = (json.data ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any) => ({
            id: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            avatarUrl: a.avatarUrl ?? null,
            events: a.events ?? [],
          })
        );
        setRoster(athletes);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize selected IDs from current members whenever group changes
  useEffect(() => {
    setSelectedIds(new Set(group.members.map((m) => m.athleteId)));
  }, [group]);

  // Filter roster to show athletes whose events overlap with the group's events
  const filteredRoster = useMemo(() => {
    const groupEvents = new Set<string>(group.events);
    return roster.filter((a) => a.events.some((e) => groupEvents.has(e)));
  }, [roster, group.events]);

  const toggleAthlete = useCallback((athleteId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) {
        next.delete(athleteId);
      } else {
        next.add(athleteId);
      }
      return next;
    });
  }, []);

  // Compute diff
  const currentMemberIds = useMemo(
    () => new Set(group.members.map((m) => m.athleteId)),
    [group.members]
  );

  const hasChanges = useMemo(() => {
    if (selectedIds.size !== currentMemberIds.size) return true;
    for (const id of selectedIds) {
      if (!currentMemberIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, currentMemberIds]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const added = [...selectedIds].filter((id) => !currentMemberIds.has(id));
      const removed = [...currentMemberIds].filter((id) => !selectedIds.has(id));

      // Add new members
      if (added.length > 0) {
        const res = await fetch(`/api/coach/event-groups/${group.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ athleteIds: added }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to add members");
        }
      }

      // Remove members
      for (const athleteId of removed) {
        const res = await fetch(`/api/coach/event-groups/${group.id}/members/${athleteId}`, {
          method: "DELETE",
          headers: csrfHeaders(),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to remove member");
        }
      }

      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update members");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Loading state ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Manage Members
        </h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  /* ─── Error state ────────────────────────────────────────────────────── */
  if (error && roster.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-danger-500 dark:text-danger-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary-500 hover:underline mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Manage Members</h3>

      {filteredRoster.length === 0 ? (
        <p className="text-sm text-muted py-4">
          No athletes on your roster match this group&apos;s events.
        </p>
      ) : (
        <div className="space-y-1 max-h-[320px] overflow-y-auto custom-scrollbar">
          {filteredRoster.map((athlete) => {
            const isChecked = selectedIds.has(athlete.id);
            return (
              <label
                key={athlete.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleAthlete(athlete.id)}
                  className="form-checkbox rounded border-surface-300 dark:border-surface-600 text-primary-500 focus:ring-primary-500/50"
                />
                <Avatar
                  name={`${athlete.firstName} ${athlete.lastName}`}
                  src={athlete.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate block">
                    {athlete.firstName} {athlete.lastName}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {athlete.events.map((event) => (
                      <Badge key={event} variant="neutral" className="text-[10px] px-1.5 py-0">
                        {EVENT_LABELS[event] ?? event}
                      </Badge>
                    ))}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Error inline */}
      {error && <p className="text-sm text-danger-500 dark:text-danger-400">{error}</p>}

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!hasChanges || saving}
          loading={saving}
          onClick={handleSave}
          leftIcon={saving ? undefined : undefined}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
