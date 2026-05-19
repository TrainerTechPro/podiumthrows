"use client";

import { createContext, useContext, useState, Fragment, ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search as SearchLucide,
  ChevronDown,
  ChevronUp,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { SkeletonTableRow, Skeleton } from "./Skeleton";
import { useDataTable } from "./useDataTable";
import type { UseDataTableReturn } from "./useDataTable";

/* ─── Context (compound component API) ──────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataTableCtx = createContext<UseDataTableReturn<any> | null>(null);

function useDataTableContext<T>(): UseDataTableReturn<T> {
  const ctx = useContext(DataTableCtx) as UseDataTableReturn<T> | null;
  if (!ctx)
    throw new Error("DataTable compound components must be used within <DataTableProvider>");
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
  /** Hide below `sm:` (640px). For complete hide below md, prefer `renderCard`. */
  hideOnMobile?: boolean;
  /** Numeric column — applies `tabular-nums` to td and right-aligns header. */
  numeric?: boolean;
  /** Explicit alignment override (defaults: left, or right when numeric). */
  align?: "left" | "right" | "center";
  /**
   * Sort comparator value. Use when sorting by a derived value — nested
   * field, enum order, fallback rank, etc. Receives the row and returns a
   * comparable. `null`/`undefined` sorts to the end of the asc list.
   */
  sortValue?: (row: T) => string | number | null | undefined;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Unique key per row */
  rowKey: keyof T;
  loading?: boolean;
  /**
   * Distinct error state — replaces the table body with an error EmptyState.
   * Provide `onRetry` to wire the built-in retry button.
   */
  error?: string | null;
  onRetry?: () => void;
  /** Number of skeleton rows while loading */
  skeletonRows?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rows per page (0 = disable pagination) */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  /** CTA shown inside the empty state (e.g. "Invite athlete"). */
  emptyAction?: ReactNode;
  /** Called when row is clicked */
  onRowClick?: (row: T) => void;
  /** Dynamic class for each row (e.g. colored left borders) */
  rowClassName?: (row: T) => string | undefined;
  className?: string;
  /** Slot for toolbar actions (right side) */
  actions?: ReactNode;
  /**
   * Filter slot rendered between toolbar and table. Use for chip/segmented
   * controls. On mobile this wraps to its own row.
   */
  filters?: ReactNode;
  /**
   * Mobile card renderer — when provided, sub-768px renders cards instead of
   * the horizontal-scroll table. The table still renders at md+.
   *
   * Coach surfaces SHOULD provide this so the table doesn't become a wall
   * of horizontal-scroll on phones (see CLAUDE.md §Dual Product Identity).
   */
  renderCard?: (row: T, idx: number) => ReactNode;
  /**
   * Persist `query`, `sort`, `dir`, `page` to URL searchParams. Use a prefix
   * when multiple tables share a route; `""` for no prefix.
   */
  urlStateKey?: string;
  /** Default sort applied when no URL/local sort is set. */
  defaultSort?: { key: string; dir?: SortDirection };
  /**
   * Renders below a row when it is expanded. Returning `null` makes the row
   * non-expandable (handy for conditional expand). The expanded cell spans
   * all columns; provide your own padding inside.
   */
  renderExpanded?: (row: T) => ReactNode;
  /**
   * Persist the set of expanded row keys (`rowKey` values) to the URL — a
   * comma-separated `?expand=<id>,<id>` list. Falls back to local state when
   * omitted. Requires `renderExpanded` to do anything.
   */
  expandedUrlKey?: string;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  skeletonRows = 5,
  searchable = false,
  searchPlaceholder = "Search…",
  pageSize = 10,
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  onRowClick,
  rowClassName,
  className,
  actions,
  filters,
  renderCard,
  urlStateKey,
  defaultSort,
  renderExpanded,
  expandedUrlKey,
}: DataTableProps<T>) {
  const dt = useDataTable({ data, columns, pageSize, loading, urlStateKey, defaultSort });
  const expanded = useExpandedRowState<T>({ rowKey, urlKey: expandedUrlKey });
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
  } = dt;

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    toggleSort(String(col.key));
  };

  const showError = !loading && !!error;
  const showEmpty = !loading && !showError && paginated.length === 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Toolbar */}
      {(searchable || actions) && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {searchable && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <SearchLucide
                size={16}
                strokeWidth={1.75}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="input pl-9"
                aria-label="Search"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
        </div>
      )}

      {/* Filter row */}
      {filters && <div className="mb-4 flex items-center gap-2 flex-wrap">{filters}</div>}

      {/* Mobile card view (sub-md) — only when renderCard is provided */}
      {renderCard && (
        <div className="md:hidden">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : showError ? (
            <div className="card">
              <EmptyState
                tone="error"
                title="Couldn't load data"
                description={error || "Couldn’t load this data. Try again in a moment."}
                onRetry={onRetry}
              />
            </div>
          ) : showEmpty ? (
            <div className="card">
              <EmptyState
                compact
                title={query ? `No results for "${query}"` : emptyTitle}
                description={query ? "Try a different search term." : emptyDescription}
                action={query ? undefined : emptyAction}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {paginated.map((row, idx) => (
                <div key={String(row[rowKey])}>{renderCard(row, idx)}</div>
              ))}
            </div>
          )}

          {/* Pagination (mobile) */}
          {!loading && !showError && !showEmpty && pageSize > 0 && totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              sortedCount={sorted.length}
              pageSize={pageSize}
              setPage={setPage}
              className="mt-4"
            />
          )}
        </div>
      )}

      {/* Table view — full at md+, OR all viewports if no renderCard provided */}
      <div className={cn("card overflow-hidden", renderCard && "hidden md:block")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col)}
                    className={cn(
                      "px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted whitespace-nowrap",
                      headerAlignClass(col),
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
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        (col.align ?? (col.numeric ? "right" : "left")) === "right" &&
                          "flex-row-reverse"
                      )}
                    >
                      {col.header}
                      {col.sortable && (
                        <SortIcon active={sortKey === String(col.key)} direction={sortDir} />
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
              ) : showError ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      tone="error"
                      title="Couldn't load data"
                      description={error || "Couldn’t load this data. Try again in a moment."}
                      onRetry={onRetry}
                    />
                  </td>
                </tr>
              ) : showEmpty ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      compact
                      title={query ? `No results for "${query}"` : emptyTitle}
                      description={query ? "Try a different search term." : emptyDescription}
                      action={query ? undefined : emptyAction}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((row, rowIdx) => {
                  const key = String(row[rowKey]);
                  const expandedContent = renderExpanded?.(row);
                  const isExpandable = expandedContent != null;
                  const isOpen = isExpandable && expanded.has(key);
                  const rowClickable = onRowClick != null;
                  const expandable = isExpandable && !rowClickable;

                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => {
                          if (rowClickable) onRowClick(row);
                          else if (expandable) expanded.toggle(key);
                        }}
                        onKeyDown={
                          rowClickable || expandable
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (rowClickable) onRowClick(row);
                                  else expanded.toggle(key);
                                }
                              }
                            : undefined
                        }
                        tabIndex={rowClickable || expandable ? 0 : undefined}
                        role={rowClickable ? "button" : expandable ? "button" : undefined}
                        aria-expanded={expandable ? isOpen : undefined}
                        className={cn(
                          "transition-colors",
                          (rowClickable || expandable) &&
                            "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
                          isOpen && "bg-surface-50 dark:bg-surface-800/40",
                          rowClassName?.(row)
                        )}
                      >
                        {columns.map((col) => (
                          <td
                            key={String(col.key)}
                            className={cn(
                              "px-4 py-3.5 text-[var(--foreground)]",
                              cellAlignClass(col),
                              col.numeric && "tabular-nums",
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
                      {isOpen && expandedContent && (
                        <tr className="bg-surface-50 dark:bg-surface-900/40">
                          <td colSpan={columns.length} className="px-4 py-4">
                            {expandedContent}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (table) */}
        {!loading && !showError && !showEmpty && pageSize > 0 && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            sortedCount={sorted.length}
            pageSize={pageSize}
            setPage={setPage}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  sortedCount,
  pageSize,
  setPage,
  className,
}: {
  page: number;
  totalPages: number;
  sortedCount: number;
  pageSize: number;
  setPage: (p: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 border-t border-[var(--card-border)]",
        className
      )}
    >
      <p className="text-xs text-muted tabular-nums">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedCount)} of {sortedCount}
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
            <PageButton key={p} onClick={() => setPage(p)} active={p === page}>
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
        "min-w-[44px] min-h-[44px] px-1.5 rounded-lg text-xs font-medium transition-colors tabular-nums",
        active
          ? "bg-primary-500 text-[var(--color-text-on-brand)]"
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

/* ─── Expanded-row state (local OR url-backed) ───────────────────────────── */

interface ExpandedState {
  has: (key: string) => boolean;
  toggle: (key: string) => void;
}

function useExpandedRowState<T>({
  rowKey: _rowKey,
  urlKey,
}: {
  rowKey: keyof T;
  urlKey?: string;
}): ExpandedState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [local, setLocal] = useState<Set<string>>(() => new Set());

  if (urlKey) {
    const raw = searchParams?.get(urlKey) ?? "";
    const keys = new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const toggle = (key: string) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (next.size === 0) sp.delete(urlKey);
      else sp.set(urlKey, [...next].join(","));
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    return {
      has: (k) => keys.has(k),
      toggle,
    };
  }

  return {
    has: (k) => local.has(k),
    toggle: (k) => {
      setLocal((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
    },
  };
}

function headerAlignClass<T>(col: Column<T>): string {
  const align = col.align ?? (col.numeric ? "right" : "left");
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function cellAlignClass<T>(col: Column<T>): string {
  const align = col.align ?? (col.numeric ? "right" : "left");
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "";
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
        strokeWidth={1.75}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
        aria-label="Search"
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
              "px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted whitespace-nowrap",
              headerAlignClass(col),
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
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                (col.align ?? (col.numeric ? "right" : "left")) === "right" && "flex-row-reverse"
              )}
            >
              {col.header}
              {col.sortable && (
                <SortIcon active={sortKey === String(col.key)} direction={sortDir} />
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
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  skeletonRows = 5,
}: {
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
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
              description={query ? "Try a different search term." : emptyDescription}
              action={query ? undefined : emptyAction}
            />
          </td>
        </tr>
      ) : (
        paged.map((row, rowIdx) => (
          <tr
            key={String(row[rowKey])}
            onClick={() => onRowClick?.(row)}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? "button" : undefined}
            className={cn(
              "transition-colors",
              onRowClick &&
                "cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
              rowClassName?.(row)
            )}
          >
            {columns.map((col) => (
              <td
                key={String(col.key)}
                className={cn(
                  "px-4 py-3.5 text-[var(--foreground)]",
                  cellAlignClass(col),
                  col.numeric && "tabular-nums",
                  col.hideOnMobile && "hidden sm:table-cell",
                  col.className
                )}
              >
                {col.cell ? col.cell(row, rowIdx) : String(row[col.key as keyof T] ?? "—")}
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
  const { page, totalPages, sorted, setPage, loading } = useDataTableContext();

  if (loading || pageSize <= 0 || totalPages <= 1) return null;

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      sortedCount={sorted.length}
      pageSize={pageSize}
      setPage={setPage}
    />
  );
}
