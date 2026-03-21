"use client";

import { useState, useEffect, useCallback } from "react";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Button, EmptyState, StaggeredList } from "@/components";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { GroupCard } from "./_group-card";
import { GroupModal } from "./_group-modal";
import { MemberManager } from "./_member-manager";
import { csrfHeaders } from "@/lib/csrf-client";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function EventGroupsPage() {
  const [groups, setGroups] = useState<EventGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EventGroupItem | null>(null);

  /* ─── Fetch groups ─────────────────────────────────────────────────── */
  const fetchGroups = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/coach/event-groups");
      if (!res.ok) throw new Error("Failed to load event groups");
      const json = await res.json();
      setGroups(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  /* ─── Handlers ─────────────────────────────────────────────────────── */

  const handleCardClick = useCallback((groupId: string) => {
    setSelectedGroupId((prev) => (prev === groupId ? null : groupId));
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingGroup(null);
    setModalOpen(true);
  }, []);

  const handleEditClick = useCallback(() => {
    const g = groups.find((g) => g.id === selectedGroupId);
    if (g) {
      setEditingGroup(g);
      setModalOpen(true);
    }
  }, [groups, selectedGroupId]);

  const handleDeleteClick = useCallback(async () => {
    if (!selectedGroupId) return;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return;

    const confirmed = window.confirm(
      `Delete "${group.name}"? This will remove the group and unlink all members. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/coach/event-groups/${selectedGroupId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete group");
      }
      setSelectedGroupId(null);
      fetchGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete group");
    }
  }, [selectedGroupId, groups, fetchGroups]);

  const handleModalSaved = useCallback(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleMembersUpdated = useCallback(() => {
    fetchGroups();
  }, [fetchGroups]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  /* ─── Loading skeleton ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-surface-200 dark:bg-surface-800 animate-shimmer" />
          <div className="h-10 w-36 rounded-xl bg-surface-200 dark:bg-surface-800 animate-shimmer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  /* ─── Error state ──────────────────────────────────────────────────── */
  if (error && groups.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--foreground)]">Event Groups</h1>
        <div className="text-center py-12">
          <p className="text-sm text-danger-500 dark:text-danger-400 mb-3">{error}</p>
          <Button variant="secondary" onClick={fetchGroups}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  /* ─── Main render ──────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-[var(--foreground)]">Event Groups</h1>
        <Button
          variant="primary"
          onClick={handleCreateClick}
          leftIcon={<Plus size={18} strokeWidth={1.75} aria-hidden="true" />}
        >
          Create Group
        </Button>
      </div>

      {/* Empty state */}
      {groups.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} strokeWidth={1.75} aria-hidden="true" />}
          title="No event groups yet"
          description="Create your first group to start organizing athletes by event."
          action={
            <Button variant="primary" onClick={handleCreateClick}>
              Create Group
            </Button>
          }
        />
      ) : (
        <>
          {/* Group grid */}
          <StaggeredList className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() => handleCardClick(group.id)}
                selected={selectedGroupId === group.id}
              />
            ))}
          </StaggeredList>

          {/* Selected group detail panel */}
          {selectedGroup && (
            <div className="card p-5 space-y-4 animate-fade-slide-in">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: selectedGroup.color || "#f59e0b",
                    }}
                    aria-hidden="true"
                  />
                  <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
                    {selectedGroup.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleEditClick}
                    leftIcon={<Pencil size={14} strokeWidth={1.75} aria-hidden="true" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteClick}
                    leftIcon={<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Description */}
              {selectedGroup.description && (
                <p className="text-sm text-muted">{selectedGroup.description}</p>
              )}

              {/* Member manager */}
              <MemberManager
                key={selectedGroup.id}
                group={selectedGroup}
                onUpdated={handleMembersUpdated}
              />
            </div>
          )}
        </>
      )}

      {/* Create / Edit modal */}
      <GroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        group={editingGroup}
        onSaved={handleModalSaved}
      />
    </div>
  );
}
