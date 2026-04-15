"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Check, Settings2 } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { ManageGroupsModal } from "./_manage-groups-modal";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type TeamOption = {
  id: string;
  name: string;
  parentTeamId: string | null;
  order: number;
  memberCount: number;
};

type TeamNode = TeamOption & { children: TeamNode[] };

/* ─── Tree builder ───────────────────────────────────────────────────────── */

function buildTree(flat: TeamOption[]): TeamNode[] {
  const byId = new Map<string, TeamNode>();
  for (const t of flat) {
    byId.set(t.id, { ...t, children: [] });
  }
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
  for (const node of byId.values()) {
    node.children.sort(sortFn);
  }
  return roots;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function TeamFilter({
  teams,
  currentTeamId,
}: {
  teams: TeamOption[];
  currentTeamId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildTree(teams), [teams]);

  // Auto-expand the parent of the currently selected sub-group so the
  // selection is visible when the dropdown reopens.
  useEffect(() => {
    if (!currentTeamId) return;
    const selected = teams.find((t) => t.id === currentTeamId);
    if (selected?.parentTeamId) {
      setExpanded((prev) => {
        if (prev.has(selected.parentTeamId!)) return prev;
        const next = new Set(prev);
        next.add(selected.parentTeamId!);
        return next;
      });
    }
  }, [currentTeamId, teams]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentLabel = (() => {
    if (currentTeamId === "unassigned") return "Unassigned";
    if (!currentTeamId) return "All Athletes";
    const t = teams.find((x) => x.id === currentTeamId);
    return t?.name ?? "All Athletes";
  })();

  function handleSelect(value: string) {
    // Persist preference (best-effort, non-blocking)
    fetch("/api/coach/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ lastTeamId: value || null }),
    }).catch(() => {});

    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("teamId", value);
    else params.delete("teamId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalMembers = teams.reduce((sum, t) => {
    // Don't double-count sub-group members (they're already counted in their own row).
    // "All Athletes" is a conceptual count derived from the page's roster, not this list.
    return sum + (t.parentTeamId === null ? 0 : 0);
  }, 0);
  void totalMembers; // reserved for future use

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] font-medium hover:border-primary-500/40 transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span>{currentLabel}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-64 max-h-[min(480px,calc(100vh-8rem))] rounded-xl border border-[var(--card-border)] bg-[var(--surface-overlay)] shadow-xl z-50 flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto custom-scrollbar py-1.5">
            <FilterRow
              label="All Athletes"
              selected={!currentTeamId}
              onClick={() => handleSelect("")}
            />
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                currentTeamId={currentTeamId}
                expanded={expanded}
                onToggle={toggleExpand}
                onSelect={handleSelect}
              />
            ))}
            <FilterRow
              label="Unassigned"
              selected={currentTeamId === "unassigned"}
              onClick={() => handleSelect("unassigned")}
              muted
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setManageOpen(true);
              setOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-primary-600 dark:text-primary-400 border-t border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <Settings2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Manage groups
          </button>
        </div>
      )}

      <ManageGroupsModal open={manageOpen} onClose={() => setManageOpen(false)} teams={teams} />
    </div>
  );
}

/* ─── Tree row ───────────────────────────────────────────────────────────── */

function TreeNode({
  node,
  depth,
  currentTeamId,
  expanded,
  onToggle,
  onSelect,
}: {
  node: TeamNode;
  depth: number;
  currentTeamId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = currentTeamId === node.id;

  return (
    <>
      <div
        className={`flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary-500/10 text-[var(--foreground)]"
            : "hover:bg-surface-50 dark:hover:bg-surface-800/50 text-[var(--foreground)]"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="shrink-0 rounded p-0.5 hover:bg-surface-100 dark:hover:bg-surface-700 text-muted"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="shrink-0 w-4" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex-1 flex items-center justify-between text-sm min-w-0 text-left"
          role="menuitemradio"
          aria-checked={isSelected}
        >
          <span className="truncate">{node.name}</span>
          <span className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="text-xs font-mono text-muted tabular-nums">{node.memberCount}</span>
            {isSelected && (
              <Check size={12} strokeWidth={2.25} className="text-primary-500" aria-hidden="true" />
            )}
          </span>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              currentTeamId={currentTeamId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  );
}

/* ─── Flat row (All Athletes, Unassigned) ────────────────────────────────── */

function FilterRow({
  label,
  selected,
  onClick,
  muted = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemradio"
      aria-checked={selected}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
        selected
          ? "bg-primary-500/10 text-[var(--foreground)]"
          : `hover:bg-surface-50 dark:hover:bg-surface-800/50 ${muted ? "text-muted" : "text-[var(--foreground)]"}`
      }`}
    >
      <span>{label}</span>
      {selected && (
        <Check size={12} strokeWidth={2.25} className="text-primary-500" aria-hidden="true" />
      )}
    </button>
  );
}
