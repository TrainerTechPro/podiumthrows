"use client";

import { useState, useEffect } from "react";
import UserAvatar from "@/components/user-avatar";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface TeamData {
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
  avatarUrl?: string | null;
  user: { email: string; claimedAt: string | null };
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "#D4915A",
  DISCUS: "#6A9FD8",
  HAMMER: "#5BB88A",
  JAVELIN: "#D46A6A",
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create/Edit form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Manage members
  const [managingTeamId, setManagingTeamId] = useState<string | null>(null);
  const [allAthletes, setAllAthletes] = useState<RosterAthlete[]>([]);
  const [teamMembers, setTeamMembers] = useState<RosterAthlete[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");

  // ── Data fetching ─────────────────────────────────────────

  function loadTeams() {
    setLoading(true);
    setError("");
    fetch("/api/coach/teams")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTeams(data.data);
        else setError(data.error || "Failed to load teams");
      })
      .catch(() => setError("Failed to load teams"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTeams();
  }, []);

  // ── Create / Edit ─────────────────────────────────────────

  function openCreateForm() {
    setShowCreateForm(true);
    setEditingTeamId(null);
    setManagingTeamId(null);
    setFormName("");
    setFormDescription("");
    setFormError("");
  }

  function openEditForm(team: TeamData) {
    setEditingTeamId(team.id);
    setShowCreateForm(false);
    setManagingTeamId(null);
    setFormName(team.name);
    setFormDescription(team.description || "");
    setFormError("");
  }

  async function handleSaveTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setFormLoading(true);
    setFormError("");

    try {
      const isEdit = !!editingTeamId;
      const res = await fetch(
        isEdit ? `/api/coach/teams/${editingTeamId}` : "/api/coach/teams",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ name: formName, description: formDescription || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save team");
      setShowCreateForm(false);
      setEditingTeamId(null);
      loadTeams();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save team");
    } finally {
      setFormLoading(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────

  async function handleDelete(teamId: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/coach/teams/${teamId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setConfirmDeleteId(null);
      loadTeams();
    } catch {
      // Error is non-critical for delete
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Manage Members ────────────────────────────────────────

  async function openManageMembers(teamId: string) {
    setManagingTeamId(teamId);
    setShowCreateForm(false);
    setEditingTeamId(null);
    setMembersLoading(true);
    setMembersError("");
    setSelectedToAdd(new Set());

    try {
      const [rosterRes, teamRes] = await Promise.all([
        fetch("/api/coach/athletes").then((r) => r.json()),
        fetch(`/api/coach/athletes?teamId=${teamId}`).then((r) => r.json()),
      ]);
      if (rosterRes.ok) setAllAthletes(rosterRes.data);
      if (teamRes.ok) setTeamMembers(teamRes.data);
    } catch {
      setMembersError("Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleAddMembers() {
    if (!managingTeamId || selectedToAdd.size === 0) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/coach/teams/${managingTeamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ athleteIds: Array.from(selectedToAdd) }),
      });
      if (!res.ok) throw new Error("Failed to add members");
      setSelectedToAdd(new Set());
      await openManageMembers(managingTeamId);
      loadTeams();
    } catch {
      setMembersError("Failed to add members");
      setMembersLoading(false);
    }
  }

  async function handleRemoveMember(athleteId: string) {
    if (!managingTeamId) return;
    try {
      await fetch(`/api/coach/teams/${managingTeamId}/members/${athleteId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      await openManageMembers(managingTeamId);
      loadTeams();
    } catch {
      setMembersError("Failed to remove member");
    }
  }

  function toggleSelectAthlete(id: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Derived ───────────────────────────────────────────────

  const managingTeam = teams.find((t) => t.id === managingTeamId);
  const teamMemberIds = new Set(teamMembers.map((m) => m.id));
  const availableAthletes = allAthletes.filter((a) => !teamMemberIds.has(a.id));

  // ── Loading skeleton ──────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-spring-up space-y-4">
        <div className="skeleton h-8 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────

  if (error && teams.length === 0) {
    return (
      <div className="animate-spring-up space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Teams</h1>
        <div className="card text-center py-12 space-y-3">
          <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
          <button onClick={loadTeams} className="btn-primary text-sm px-4 py-2">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-spring-up space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Teams</h1>
        <button
          onClick={openCreateForm}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Team
        </button>
      </div>

      {/* ── Create / Edit Form ──────────────────────────────── */}
      {(showCreateForm || editingTeamId) && (
        <div className="card !p-5 border-2 border-[rgba(212,168,67,0.2)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text)] text-sm">
              {editingTeamId ? "Edit Team" : "Create Team"}
            </h3>
            <button
              onClick={() => { setShowCreateForm(false); setEditingTeamId(null); }}
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text-2)] rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSaveTeam} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Team Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                maxLength={100}
                placeholder="e.g., UCSD Shot Put"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
                Description <span className="text-[var(--color-text-3)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g., Division I training group"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
              />
            </div>
            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setEditingTeamId(null); }}
                className="btn-secondary text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading || !formName.trim()}
                className="btn-primary text-sm px-4 py-2 disabled:opacity-60"
              >
                {formLoading ? "Saving..." : editingTeamId ? "Save Changes" : "Create Team"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Manage Members Panel ────────────────────────────── */}
      {managingTeamId && managingTeam && (
        <div className="card !p-5 border-2 border-[rgba(212,168,67,0.2)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text)] text-sm">
              Manage Members — {managingTeam.name}
            </h3>
            <button
              onClick={() => setManagingTeamId(null)}
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text-2)] rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
            </div>
          ) : (
            <>
              {membersError && (
                <p className="text-xs text-red-600 dark:text-red-400">{membersError}</p>
              )}

              {/* Current members */}
              {teamMembers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
                    Current Members ({teamMembers.length})
                  </p>
                  <div className="space-y-1.5">
                    {teamMembers.map((athlete) => (
                      <div key={athlete.id} className="flex items-center gap-2 p-2 rounded-xl bg-[var(--color-bg-subtle)]">
                        <UserAvatar
                          src={athlete.avatarUrl}
                          firstName={athlete.firstName}
                          lastName={athlete.lastName}
                          size="sm"
                        />
                        <span className="text-sm text-[var(--color-text)] flex-1">
                          {athlete.firstName} {athlete.lastName}
                        </span>
                        <div className="flex gap-1">
                          {athlete.events.map((ev) => (
                            <span
                              key={ev}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: EVENT_COLORS[ev] || "#999" }}
                            >
                              {EVENT_LABELS[ev] || ev}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => handleRemoveMember(athlete.id)}
                          className="p-1 text-[var(--color-text-3)] hover:text-red-500 transition-colors"
                          title="Remove from team"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add athletes */}
              {availableAthletes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
                    Add Athletes
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {availableAthletes.map((athlete) => (
                      <label
                        key={athlete.id}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-[var(--color-bg-subtle)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedToAdd.has(athlete.id)}
                          onChange={() => toggleSelectAthlete(athlete.id)}
                          className="accent-[var(--color-gold)]"
                        />
                        <UserAvatar
                          src={athlete.avatarUrl}
                          firstName={athlete.firstName}
                          lastName={athlete.lastName}
                          size="sm"
                        />
                        <span className="text-sm text-[var(--color-text)] flex-1">
                          {athlete.firstName} {athlete.lastName}
                        </span>
                        <div className="flex gap-1">
                          {athlete.events.map((ev) => (
                            <span
                              key={ev}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: EVENT_COLORS[ev] || "#999" }}
                            >
                              {EVENT_LABELS[ev] || ev}
                            </span>
                          ))}
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleAddMembers}
                    disabled={selectedToAdd.size === 0 || membersLoading}
                    className="btn-primary text-sm px-4 py-2 disabled:opacity-60"
                  >
                    Add Selected ({selectedToAdd.size})
                  </button>
                </div>
              ) : teamMembers.length > 0 ? (
                <p className="text-xs text-[var(--color-text-3)]">All athletes are already in this team.</p>
              ) : (
                <p className="text-xs text-[var(--color-text-3)]">No athletes on your roster yet.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Team Cards ──────────────────────────────────────── */}
      {teams.length === 0 && !showCreateForm ? (
        <div className="card text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(212,168,67,0.08)] flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)] text-sm">No teams yet</p>
            <p className="text-xs text-[var(--color-text-3)] mt-1">
              Create your first team to organize your athletes by school, training group, or any way you like.
            </p>
          </div>
          <button onClick={openCreateForm} className="btn-primary text-sm px-4 py-2 mx-auto">
            Create Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="card !p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-semibold text-[var(--color-text)] truncate">
                    {team.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-3)] truncate">
                    {team.description || "No description"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => openEditForm(team)}
                    className="p-1.5 text-[var(--color-text-3)] hover:text-[var(--color-text-2)] rounded-lg transition-colors"
                    title="Edit team"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {confirmDeleteId === team.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(team.id)}
                        disabled={deleteLoading}
                        className="text-[10px] px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deleteLoading ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(team.id)}
                      className="p-1.5 text-[var(--color-text-3)] hover:text-red-500 rounded-lg transition-colors"
                      title="Delete team"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {team.memberCount} athlete{team.memberCount !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-1">
                  {Object.entries(team.eventBreakdown).map(([ev, count]) => (
                    <span
                      key={ev}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: EVENT_COLORS[ev] || "#999" }}
                    >
                      {count} {EVENT_LABELS[ev] || ev}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={() => openManageMembers(team.id)}
                className="btn-primary text-xs w-full py-2"
              >
                Manage Members
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
