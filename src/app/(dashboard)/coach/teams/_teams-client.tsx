"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/Checkbox";
import { csrfHeaders } from "@/lib/csrf-client";
import { UsersRound, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { logger } from "@/lib/logger";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface TeamItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  eventBreakdown: Record<string, number>;
  createdAt: string;
}

interface RosterAthlete {
  id: string;
  firstName: string;
  lastName: string;
  events: string[];
  avatarUrl: string | null;
}

/* ─── Event Color Map ────────────────────────────────────────────────────── */

const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "#E85D26",
  DISCUS: "#2563EB",
  HAMMER: "#7C3AED",
  JAVELIN: "#059669",
};

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

/* ─── Shimmer Skeleton ───────────────────────────────────────────────────── */

function TeamCardSkeleton() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-5 w-2/3 rounded bg-surface-700/40 shimmer" />
      <div className="h-4 w-1/2 rounded bg-surface-700/30 shimmer" />
      <div className="h-4 w-1/4 rounded bg-surface-700/20 shimmer" />
      <div className="flex gap-2 pt-2">
        <div className="h-7 w-20 rounded bg-surface-700/20 shimmer" />
        <div className="h-7 w-8 rounded bg-surface-700/20 shimmer" />
        <div className="h-7 w-8 rounded bg-surface-700/20 shimmer" />
      </div>
    </div>
  );
}

/* ─── Event Pill ─────────────────────────────────────────────────────────── */

function EventPill({ event, count }: { event: string; count?: number }) {
  const bg = EVENT_COLORS[event] ?? "#888";
  const label = EVENT_LABELS[event] ?? event;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: bg }}
    >
      {label}
      {count !== undefined && count > 0 && <span className="opacity-80">{count}</span>}
    </span>
  );
}

/* ─── Avatar Circle ──────────────────────────────────────────────────────── */

function AvatarCircle({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-semibold text-muted shrink-0">
      {initials}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function TeamsClient() {
  const toast = useToast();

  /* ── State ── */
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [roster, setRoster] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Member panel state
  const [managingTeam, setManagingTeam] = useState<TeamItem | null>(null);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  /* ── Data Fetching ── */

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/teams");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Failed to load groups");
        return;
      }
      setTeams(payload.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error loading groups");
    }
  }, [toast]);

  const fetchRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/athletes");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Failed to load roster");
        return;
      }
      setRoster(
        payload.data.map(
          (a: {
            id: string;
            firstName: string;
            lastName: string;
            events: string[];
            avatarUrl: string | null;
          }) => ({
            id: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            events: a.events,
            avatarUrl: a.avatarUrl,
          })
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error loading roster");
    }
  }, [toast]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchTeams(), fetchRoster()]);
      setLoading(false);
    }
    load();
  }, [fetchTeams, fetchRoster]);

  /* ── Form Helpers ── */

  function openCreateForm() {
    setManagingTeam(null);
    setEditingTeam(null);
    setFormName("");
    setFormDesc("");
    setFormOpen(true);
  }

  function openEditForm(team: TeamItem) {
    setManagingTeam(null);
    setEditingTeam(team);
    setFormName(team.name);
    setFormDesc(team.description ?? "");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingTeam(null);
    setFormName("");
    setFormDesc("");
  }

  async function handleSave() {
    const name = formName.trim();
    if (!name) {
      toast.error("Group name is required");
      return;
    }

    setSaving(true);
    try {
      const isEdit = editingTeam !== null;
      const url = isEdit ? `/api/coach/teams/${editingTeam.id}` : "/api/coach/teams";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ name, description: formDesc.trim() || null }),
      });
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Failed to save group");
        return;
      }

      toast.success(isEdit ? "Group updated" : "Group created");
      closeForm();
      await fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ── */

  async function handleDelete(team: TeamItem) {
    const confirmed = window.confirm(
      `Delete group "${team.name}"? Athletes won't be removed from your roster.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/coach/teams/${team.id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Failed to delete group");
        return;
      }

      toast.success("Group deleted");

      // Close member panel if it was showing this team
      if (managingTeam?.id === team.id) {
        setManagingTeam(null);
      }

      await fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    }
  }

  /* ── Member Management ── */

  function openMemberPanel(team: TeamItem) {
    setFormOpen(false);
    setEditingTeam(null);
    setManagingTeam(team);
    setSelectedAthleteIds(new Set());
  }

  function closeMemberPanel() {
    setManagingTeam(null);
    setSelectedAthleteIds(new Set());
  }

  // Derive which athletes are in the managing team
  // We need to use the team membership data from the teams API.
  // Since the teams API gives us memberCount + eventBreakdown but not member IDs,
  // we fetch the roster filtered by teamId.
  const [teamMembers, setTeamMembers] = useState<RosterAthlete[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!managingTeam) {
      setTeamMembers([]);
      return;
    }

    async function loadMembers() {
      setLoadingMembers(true);
      try {
        const res = await fetch(`/api/coach/athletes?teamId=${managingTeam!.id}`);
        const payload = await res.json();
        if (res.ok && payload.success) {
          setTeamMembers(
            payload.data.map(
              (a: {
                id: string;
                firstName: string;
                lastName: string;
                events: string[];
                avatarUrl: string | null;
              }) => ({
                id: a.id,
                firstName: a.firstName,
                lastName: a.lastName,
                events: a.events,
                avatarUrl: a.avatarUrl,
              })
            )
          );
        }
      } catch (err) {
        // Silently fail — panel will show empty
        logger.debug("Silently fail — panel will show empty", {
          context: "src/app/(dashboard)/coach/teams/_teams-client.tsx",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
      } finally {
        setLoadingMembers(false);
      }
    }
    loadMembers();
  }, [managingTeam]);

  const memberIds = new Set(teamMembers.map((m) => m.id));
  const nonMembers = roster.filter((a) => !memberIds.has(a.id));

  function toggleAthleteSelection(id: string) {
    setSelectedAthleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAddMembers() {
    if (!managingTeam || selectedAthleteIds.size === 0) return;

    setAddingMembers(true);
    try {
      const res = await fetch(`/api/coach/teams/${managingTeam.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ athleteIds: Array.from(selectedAthleteIds) }),
      });
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Failed to add athletes");
        return;
      }

      toast.success(
        `${selectedAthleteIds.size} athlete${selectedAthleteIds.size > 1 ? "s" : ""} added`
      );
      setSelectedAthleteIds(new Set());

      // Refresh team members + teams list
      const [membersRes] = await Promise.all([
        fetch(`/api/coach/athletes?teamId=${managingTeam.id}`),
        fetchTeams(),
      ]);
      const membersPayload = await membersRes.json();
      if (membersRes.ok && membersPayload.success) {
        setTeamMembers(
          membersPayload.data.map(
            (a: {
              id: string;
              firstName: string;
              lastName: string;
              events: string[];
              avatarUrl: string | null;
            }) => ({
              id: a.id,
              firstName: a.firstName,
              lastName: a.lastName,
              events: a.events,
              avatarUrl: a.avatarUrl,
            })
          )
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setAddingMembers(false);
    }
  }

  async function handleRemoveMember(athleteId: string) {
    if (!managingTeam) return;

    setRemovingId(athleteId);
    try {
      const res = await fetch(`/api/coach/teams/${managingTeam.id}/members/${athleteId}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Failed to remove athlete");
        return;
      }

      // Update local state
      setTeamMembers((prev) => prev.filter((m) => m.id !== athleteId));
      await fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setRemovingId(null);
    }
  }

  /* ── Render ── */

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 rounded bg-surface-700/40 shimmer" />
          <div className="h-9 w-32 rounded bg-surface-700/30 shimmer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TeamCardSkeleton />
          <TeamCardSkeleton />
          <TeamCardSkeleton />
        </div>
      </div>
    );
  }

  // Empty state
  if (teams.length === 0 && !formOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Groups</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4">
            <UsersRound
              size={24}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-primary-500"
            />
          </div>
          <h2 className="text-lg font-bold font-heading text-[var(--foreground)] mb-1">
            No groups yet
          </h2>
          <p className="text-sm text-muted max-w-sm mb-6">
            Create your first group to organize your athletes by school, training group, or any way
            you like.
          </p>
          <button className="btn-primary" onClick={openCreateForm}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Create Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Groups</h1>
        <button className="btn-primary" onClick={openCreateForm}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Create Group
        </button>
      </div>

      {/* Create/Edit Form */}
      {formOpen && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
            {editingTeam ? "Edit Group" : "Create Group"}
          </h2>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="team-name"
                className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1"
              >
                Name
              </label>
              <input
                id="team-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., UCSD Shot Put"
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="team-desc"
                className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1"
              >
                Description
              </label>
              <input
                id="team-desc"
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button className="btn-secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !formName.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Manage Members Panel */}
      {managingTeam && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
              Manage — {managingTeam.name}
            </h2>
            <button
              onClick={closeMemberPanel}
              className="p-1 rounded-lg text-muted hover:text-[var(--foreground)] transition-colors"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          {/* Current Members */}
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
              Current Members ({teamMembers.length})
            </h3>
            {loadingMembers ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-surface-700/20 shimmer" />
                ))}
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-muted">No members in this group yet.</p>
            ) : (
              <div className="space-y-1">
                {teamMembers.map((athlete) => (
                  <div
                    key={athlete.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <AvatarCircle
                      name={`${athlete.firstName} ${athlete.lastName}`}
                      url={athlete.avatarUrl}
                    />
                    <span className="text-sm font-medium text-[var(--foreground)] flex-1 min-w-0 truncate">
                      {athlete.firstName} {athlete.lastName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {athlete.events.map((ev) => (
                        <EventPill key={ev} event={ev} />
                      ))}
                    </div>
                    <button
                      onClick={() => handleRemoveMember(athlete.id)}
                      disabled={removingId === athlete.id}
                      className="p-1 rounded text-muted hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
                      aria-label={`Remove ${athlete.firstName} ${athlete.lastName}`}
                    >
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Athletes */}
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
              Add Athletes
            </h3>
            {nonMembers.length === 0 ? (
              <p className="text-sm text-muted">All athletes are already in this group.</p>
            ) : (
              <>
                <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                  {nonMembers.map((athlete) => (
                    <label
                      key={athlete.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedAthleteIds.has(athlete.id)}
                        onChange={() => toggleAthleteSelection(athlete.id)}
                        aria-label={`Select ${athlete.firstName} ${athlete.lastName}`}
                      />
                      <AvatarCircle
                        name={`${athlete.firstName} ${athlete.lastName}`}
                        url={athlete.avatarUrl}
                      />
                      <span className="text-sm font-medium text-[var(--foreground)] flex-1 min-w-0 truncate">
                        {athlete.firstName} {athlete.lastName}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {athlete.events.map((ev) => (
                          <EventPill key={ev} event={ev} />
                        ))}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="pt-3">
                  <button
                    className="btn-primary"
                    onClick={handleAddMembers}
                    disabled={selectedAthleteIds.size === 0 || addingMembers}
                  >
                    <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                    {addingMembers ? "Adding..." : `Add Selected (${selectedAthleteIds.size})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="card p-5 space-y-3">
            {/* Name */}
            <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">{team.name}</h3>

            {/* Description */}
            {team.description ? (
              <p className="text-sm text-muted">{team.description}</p>
            ) : (
              <p className="text-sm text-muted italic">No description</p>
            )}

            {/* Member Count */}
            <p className="text-sm text-muted">
              {team.memberCount} athlete{team.memberCount !== 1 ? "s" : ""}
            </p>

            {/* Event Breakdown Pills */}
            {Object.keys(team.eventBreakdown).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(team.eventBreakdown).map(([event, count]) => (
                  <EventPill key={event} event={event} count={count} />
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button className="btn-secondary text-sm" onClick={() => openMemberPanel(team)}>
                Members
              </button>
              <button
                onClick={() => openEditForm(team)}
                className="p-2 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                aria-label={`Edit ${team.name}`}
              >
                <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                onClick={() => handleDelete(team)}
                className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                aria-label={`Delete ${team.name}`}
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
