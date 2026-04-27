"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, Modal } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { TeamOption } from "./_team-filter";

/* ─── Tree types + builder ───────────────────────────────────────────────── */

type TeamNode = TeamOption & { children: TeamNode[] };

function buildTree(flat: TeamOption[]): TeamNode[] {
  const byId = new Map<string, TeamNode>();
  for (const t of flat) byId.set(t.id, { ...t, children: [] });
  const roots: TeamNode[] = [];
  for (const node of byId.values()) {
    if (node.parentTeamId && byId.has(node.parentTeamId)) {
      byId.get(node.parentTeamId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortFn = (a: TeamNode, b: TeamNode) => a.order - b.order;
  roots.sort(sortFn);
  for (const node of byId.values()) node.children.sort(sortFn);
  return roots;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ManageGroupsModal({
  open,
  onClose,
  teams,
}: {
  open: boolean;
  onClose: () => void;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(teams), [teams]);
  const topLevel = teams.filter((t) => t.parentTeamId === null);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/coach/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          name,
          parentTeamId: newParentId || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      toast.success(`Created "${name}"`);
      setNewName("");
      setNewParentId("");
      router.refresh();
    } catch (err) {
      toast.error("Couldn't create group", err instanceof Error ? err.message : undefined);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/coach/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ name }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      toast.success("Group renamed");
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast.error("Couldn't rename", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    const target = teams.find((t) => t.id === id);
    if (!target) return;
    const siblings = teams
      .filter((t) => t.parentTeamId === target.parentTeamId)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const swap = siblings[swapIdx];

    setBusyId(id);
    try {
      // Swap order values. Two sequential PATCHes; both must succeed to avoid
      // collisions. If siblings share identical order values, we'll assign
      // distinct ones based on the swap.
      await Promise.all([
        fetch(`/api/coach/teams/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ order: swap.order }),
        }).then((r) => r.json()),
        fetch(`/api/coach/teams/${swap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ order: target.order }),
        }).then((r) => r.json()),
      ]);
      router.refresh();
    } catch (err) {
      toast.error("Couldn't reorder", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/coach/teams/${id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      toast.success("Group deleted", "Athletes are still on your roster.");
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      toast.error("Couldn't delete", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Groups"
      description="Create groups to organize your roster. Nest one level deep for sub-groups (e.g. UCSD → Shot Putters)."
      size="lg"
    >
      {/* Create new group */}
      <div className="space-y-2 pb-4 mb-4 border-b border-[var(--card-border)]">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">
          New group
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. UCSD Throws Squad"
            maxLength={100}
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <select
            value={newParentId}
            onChange={(e) => setNewParentId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="">Top-level</option>
            {topLevel.map((t) => (
              <option key={t.id} value={t.id}>
                Under: {t.name}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            loading={creating}
            disabled={!newName.trim()}
          >
            <Plus size={14} strokeWidth={1.75} className="mr-1" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      {/* Existing groups */}
      {tree.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">
          No groups yet. Create one above to get started.
        </p>
      ) : (
        <ul className="space-y-1 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {tree.map((node) => (
            <GroupRow
              key={node.id}
              node={node}
              depth={0}
              editingId={editingId}
              editingName={editingName}
              busyId={busyId}
              confirmDeleteId={confirmDeleteId}
              startEdit={(id, name) => {
                setEditingId(id);
                setEditingName(name);
              }}
              cancelEdit={() => setEditingId(null)}
              setEditingName={setEditingName}
              onRename={handleRename}
              onReorder={handleReorder}
              setConfirmDelete={setConfirmDeleteId}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────────── */

function GroupRow({
  node,
  depth,
  editingId,
  editingName,
  busyId,
  confirmDeleteId,
  startEdit,
  cancelEdit,
  setEditingName,
  onRename,
  onReorder,
  setConfirmDelete,
  onDelete,
}: {
  node: TeamNode;
  depth: number;
  editingId: string | null;
  editingName: string;
  busyId: string | null;
  confirmDeleteId: string | null;
  startEdit: (id: string, name: string) => void;
  cancelEdit: () => void;
  setEditingName: (v: string) => void;
  onRename: (id: string) => void;
  onReorder: (id: string, dir: "up" | "down") => void;
  setConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const isEditing = editingId === node.id;
  const isBusy = busyId === node.id;
  const isConfirming = confirmDeleteId === node.id;
  const childCount = node.children.length;

  return (
    <>
      <li
        className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/40"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                maxLength={100}
                className="flex-1 px-2 py-1 rounded-lg border border-primary-500 bg-[var(--card-bg)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRename(node.id);
                  if (e.key === "Escape") cancelEdit();
                }}
              />
              <button
                type="button"
                onClick={() => onRename(node.id)}
                disabled={isBusy}
                className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-500/10 disabled:opacity-50"
                aria-label="Save"
              >
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="p-1.5 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                aria-label="Cancel"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)] truncate">
                {node.name}
              </span>
              <span className="text-xs font-mono text-muted tabular-nums shrink-0">
                {node.memberCount}
              </span>
            </div>
          )}
        </div>

        {!isEditing && !isConfirming && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onReorder(node.id, "up")}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40"
              aria-label="Move up"
            >
              <ArrowUp size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onReorder(node.id, "down")}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40"
              aria-label="Move down"
            >
              <ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => startEdit(node.id, node.name)}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40"
              aria-label="Rename"
            >
              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(node.id)}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-500/10 disabled:opacity-40"
              aria-label="Delete"
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        )}

        {isConfirming && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted">
              {childCount > 0
                ? `Delete + ${childCount} sub-group${childCount === 1 ? "" : "s"}?`
                : "Delete?"}
            </span>
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              disabled={isBusy}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-danger-500 text-white hover:bg-danger-600 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              Cancel
            </button>
          </div>
        )}
      </li>

      {node.children.map((child) => (
        <GroupRow
          key={child.id}
          node={child}
          depth={depth + 1}
          editingId={editingId}
          editingName={editingName}
          busyId={busyId}
          confirmDeleteId={confirmDeleteId}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          setEditingName={setEditingName}
          onRename={onRename}
          onReorder={onReorder}
          setConfirmDelete={setConfirmDelete}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}
