"use client";

import { createContext, useContext, ReactNode } from "react";
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
import { useDataTable } from "./useDataTable";
import type { UseDataTableReturn } from "./useDataTable";

/* ─── Context (compound component API) ──────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataTableCtx = createContext<UseDataTableReturn<any> | null>(null);

function useDataTableContext<T>(): UseDataTableReturn<T> {
  const ctx = useContext(DataTableCtx) as UseDataTableReturn<T> | null;
  if (!ctx)
    throw new Error(
      "DataTable compound components must be used within <DataTableProvider>"
    );
  return ctx;
}

export function DataTableProvider<T extends Record<string, unknown>>({
  value,
  children,
}: {
  value: UseDataTableReturn<T>;
  children: ReactNode;
}) {
  return <DataTableCtx.Provider value={value}>{children}</DataTableCtx.Provider>;
}

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
  /** Dynamic class for each row (e.g. colored left borders) */
  rowClassName?: (row: T) => string | undefined;
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
  rowClassName,
  className,
  actions,
}: DataTableProps<T>) {
  const {
    query,
    sortKey,
    sortDir,
    page,
    sorted,
    paged: paginated,
    totalPages,
    setQuery,
    toggleSort,
    setPage,
  } = useDataTable({ data, columns, pageSize, loading });

  /* Reset page when query changes */
  const handleSearch = (v: string) => { setQuery(v); };

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    toggleSort(String(col.key));
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
                      onRowClick && "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50",
                      rowClassName?.(row)
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
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
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

/* ─── Compound sub-components ────────────────────────────────────────────── */

/** Search input that reads/writes query from the nearest DataTableProvider. */
export function DataTableSearch({
  placeholder = "Search…",
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const { query, setQuery } = useDataTableContext();
  return (
    <div className={cn("relative flex-1 min-w-[180px] max-w-xs", className)}>
      <SearchLucide
        size={16}
        strokeWidth={2}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); }}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

/** `<div className="card overflow-hidden">` wrapper. Place DTHeader + DTBody inside. */
export function DataTableRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

/** `<thead>` with sortable column headers. Reads columns/sort state from context. */
export function DataTableHeader() {
  const { columns, sortKey, sortDir, toggleSort } = useDataTableContext();

  const handleSort = (col: Column<unknown>) => {
    if (!col.sortable) return;
    toggleSort(String(col.key));
  };

  return (
    <thead>
      <tr className="border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
        {columns.map((col) => (
          <th
            key={String(col.key)}
            onClick={() => handleSort(col)}
            className={cn(
              "px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider text-muted whitespace-nowrap",
              col.sortable &&
                "cursor-pointer select-none hover:text-[var(--foreground)] transition-colors",
              col.hideOnMobile && "hidden sm:table-cell",
              col.className
            )}
            aria-sort={
              sortKey === String(col.key)
                ? sortDir === "asc"
                  ? "ascending"
                  : "descending"
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
  );
}

/** `<tbody>` with loading skeletons, empty state, and row rendering. */
export function DataTableBody<T extends Record<string, unknown>>({
  rowKey,
  onRowClick,
  rowClassName,
  emptyTitle = "No data",
  emptyDescription,
  skeletonRows = 5,
}: {
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonRows?: number;
}) {
  const { columns, paged, query, loading } = useDataTableContext<T>();

  return (
    <tbody className="divide-y divide-[var(--card-border)]">
      {loading ? (
        Array.from({ length: skeletonRows }).map((_, i) => (
          <tr key={i}>
            <td colSpan={columns.length} className="p-0">
              <SkeletonTableRow cols={columns.length} />
            </td>
          </tr>
        ))
      ) : paged.length === 0 ? (
        <tr>
          <td colSpan={columns.length}>
            <EmptyState
              compact
              title={query ? `No results for "${query}"` : emptyTitle}
              description={
                query ? "Try a different search term." : emptyDescription
              }
            />
          </td>
        </tr>
      ) : (
        paged.map((row, rowIdx) => (
          <tr
            key={String(row[rowKey])}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "transition-colors",
              onRowClick &&
                "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50",
              rowClassName?.(row)
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
  );
}

/** Pagination footer. Reads page/totalPages/sorted from context. */
export function DataTablePagination({ pageSize = 10 }: { pageSize?: number }) {
  const { page, totalPages, sorted, setPage, loading } =
    useDataTableContext();

  if (loading || pageSize <= 0 || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-[var(--card-border)]">
      <p className="text-xs text-muted">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)}{" "}
        of {sorted.length}
      </p>
      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => setPage(page - 1)}
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
            <span key={`ellipsis-${p}`} className="px-1 text-muted text-xs">
              …
            </span>
          ) : null
        )}
        <PageButton
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon size={14} strokeWidth={2.5} aria-hidden="true" />
        </PageButton>
      </div>
    </div>
  );
}
