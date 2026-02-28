"use client";

import { useState, useMemo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Search as SearchLucide,
  ChevronDown,
  ChevronUp,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { SkeletonTableRow } from "./Skeleton";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  /** Custom cell renderer */
  cell?: (row: T, idx: number) => ReactNode;
  /** If true, clicking the header sorts by this column */
  sortable?: boolean;
  /** Tailwind class(es) to apply to td/th */
  className?: string;
  /** Hidden on mobile */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Unique key per row */
  rowKey: keyof T;
  loading?: boolean;
  /** Number of skeleton rows while loading */
  skeletonRows?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rows per page (0 = disable pagination) */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Called when row is clicked */
  onRowClick?: (row: T) => void;
  className?: string;
  /** Slot for toolbar actions (right side) */
  actions?: ReactNode;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowKey,
  loading = false,
  skeletonRows = 5,
  searchable = false,
  searchPlaceholder = "Search…",
  pageSize = 10,
  emptyTitle = "No data",
  emptyDescription,
  onRowClick,
  className,
  actions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  /* Filter */
  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const raw = row[col.key as keyof T];
        return String(raw ?? "").toLowerCase().includes(q);
      })
    );
  }, [data, query, columns]);

  /* Sort */
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof T];
      const bv = b[sortKey as keyof T];
      if (av === bv) return 0;
      const cmp = av! < bv! ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  /* Paginate */
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const paginated = pageSize > 0
    ? sorted.slice((page - 1) * pageSize, page * pageSize)
    : sorted;

  /* Reset page when query changes */
  const handleSearch = (v: string) => { setQuery(v); setPage(1); };

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    const key = String(col.key);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Toolbar */}
      {(searchable || actions) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {searchable && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <SearchLucide size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="input pl-9"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col)}
                    className={cn(
                      "px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-muted whitespace-nowrap",
                      col.sortable && "cursor-pointer select-none hover:text-[var(--foreground)] transition-colors",
                      col.hideOnMobile && "hidden sm:table-cell",
                      col.className
                    )}
                    aria-sort={
                      sortKey === String(col.key)
                        ? sortDir === "asc" ? "ascending" : "descending"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && (
                        <SortIcon
                          active={sortKey === String(col.key)}
                          direction={sortDir}
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--card-border)]">
              {loading ? (
                Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="p-0">
                      <SkeletonTableRow cols={columns.length} />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      compact
                      title={query ? `No results for "${query}"` : emptyTitle}
                      description={query ? "Try a different search term." : emptyDescription}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((row, rowIdx) => (
                  <tr
                    key={String(row[rowKey])}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={cn(
                          "px-4 py-3.5 text-[var(--foreground)]",
                          col.hideOnMobile && "hidden sm:table-cell",
                          col.className
                        )}
                      >
                        {col.cell
                          ? col.cell(row, rowIdx)
                          : String(row[col.key as keyof T] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-[var(--card-border)]">
            <p className="text-xs text-muted">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of{" "}
              {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <PageButton
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeftIcon size={14} strokeWidth={2.5} aria-hidden="true" />
              </PageButton>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
                Math.abs(p - page) <= 2 || p === 1 || p === totalPages ? (
                  <PageButton
                    key={p}
                    onClick={() => setPage(p)}
                    active={p === page}
                  >
                    {p}
                  </PageButton>
                ) : p === 2 || p === totalPages - 1 ? (
                  <span key={`ellipsis-${p}`} className="px-1 text-muted text-xs">…</span>
                ) : null
              )}
              <PageButton
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRightIcon size={14} strokeWidth={2.5} aria-hidden="true" />
              </PageButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function PageButton({
  children,
  onClick,
  disabled,
  active,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors",
        active
          ? "bg-primary-500 text-white"
          : "text-muted hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-[var(--foreground)]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  const Icon = !active || direction === "asc" ? ChevronDown : ChevronUp;
  return (
    <Icon
      size={12}
      strokeWidth={2.5}
      className={cn(
        "transition-colors",
        active ? "text-primary-500" : "text-surface-300 dark:text-surface-600"
      )}
      aria-hidden="true"
    />
  );
}
