"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Column, SortDirection } from "./DataTable";

export interface UseDataTableOptions<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  loading?: boolean;
  /**
   * Persist `query`, `sort`, `dir`, `page` to the URL. The string becomes a
   * prefix on the param names — pass `""` for no prefix when the page has a
   * single table, or `"plans"` etc when multiple tables share the route.
   *
   * Falls back to local-only state when omitted (preserves existing call
   * sites that don't want their URL touched).
   */
  urlStateKey?: string;
  /** Default sort applied when no sortKey is provided. */
  defaultSort?: { key: string; dir?: SortDirection };
}

export interface UseDataTableReturn<T> {
  filtered: T[];
  sorted: T[];
  paged: T[];
  query: string;
  sortKey: string | null;
  sortDir: SortDirection;
  page: number;
  totalPages: number;
  setQuery: (q: string) => void;
  toggleSort: (key: string) => void;
  setPage: (p: number) => void;
  loading: boolean;
  columns: Column<T>[];
}

/* ─── URL-state helpers ──────────────────────────────────────────────────── */

function paramKey(prefix: string | undefined, base: string): string {
  if (prefix == null) return base;
  return prefix.length === 0 ? base : `${prefix}_${base}`;
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export function useDataTable<T extends Record<string, unknown>>(
  options: UseDataTableOptions<T>
): UseDataTableReturn<T> {
  const { data, columns, pageSize = 10, loading = false, urlStateKey, defaultSort } = options;
  const urlMode = urlStateKey !== undefined;

  /* URL-state plumbing — only used when urlStateKey is set */
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* Local-state fallback */
  const [localQuery, setLocalQuery] = useState("");
  const [localSortKey, setLocalSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [localSortDir, setLocalSortDir] = useState<SortDirection>(defaultSort?.dir ?? "asc");
  const [localPage, setLocalPage] = useState(1);

  /* Read effective state from URL or local */
  const query = urlMode ? (searchParams?.get(paramKey(urlStateKey, "q")) ?? "") : localQuery;

  const sortKey: string | null = urlMode
    ? (searchParams?.get(paramKey(urlStateKey, "sort")) ?? defaultSort?.key ?? null)
    : localSortKey;

  const sortDir: SortDirection = urlMode
    ? ((searchParams?.get(paramKey(urlStateKey, "dir")) as SortDirection) ??
      defaultSort?.dir ??
      "asc")
    : localSortDir;

  const page = urlMode
    ? Math.max(1, parseInt(searchParams?.get(paramKey(urlStateKey, "page")) ?? "1", 10) || 1)
    : localPage;

  /* Filter */
  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const raw = row[col.key as keyof T];
        return String(raw ?? "")
          .toLowerCase()
          .includes(q);
      })
    );
  }, [data, query, columns]);

  /* Sort — honors Column.sortValue when present, falls back to row[sortKey]. */
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => String(c.key) === sortKey);
    const extract = (row: T): string | number | null | undefined => {
      if (col?.sortValue) return col.sortValue(row);
      return row[sortKey as keyof T] as string | number | null | undefined;
    };
    return [...filtered].sort((a, b) => {
      const av = extract(a);
      const bv = extract(b);
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  /* Paginate */
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  /* Clamp out-of-range URL page (e.g. user lands on ?page=99 with 3 pages) */
  useEffect(() => {
    if (!urlMode) return;
    if (page > totalPages && totalPages > 0) {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      sp.delete(paramKey(urlStateKey, "page"));
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [urlMode, page, totalPages, urlStateKey, router, pathname, searchParams]);

  const paged = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  /* Coordinated URL writes — one patch per user action so query+page reset
     together and never race. */
  const writeUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  /* Actions */
  const setQuery = useCallback(
    (q: string) => {
      if (urlMode) {
        writeUrl({
          [paramKey(urlStateKey, "q")]: q || null,
          [paramKey(urlStateKey, "page")]: null,
        });
      } else {
        setLocalQuery(q);
        setLocalPage(1);
      }
    },
    [urlMode, urlStateKey, writeUrl]
  );

  const toggleSort = useCallback(
    (key: string) => {
      if (urlMode) {
        const nextDir: SortDirection = sortKey === key && sortDir === "asc" ? "desc" : "asc";
        writeUrl({
          [paramKey(urlStateKey, "sort")]: key,
          [paramKey(urlStateKey, "dir")]: nextDir,
          [paramKey(urlStateKey, "page")]: null,
        });
      } else {
        if (localSortKey === key) {
          setLocalSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
          setLocalSortKey(key);
          setLocalSortDir("asc");
        }
        setLocalPage(1);
      }
    },
    [urlMode, urlStateKey, sortKey, sortDir, localSortKey, writeUrl]
  );

  const setPage = useCallback(
    (p: number) => {
      if (urlMode) {
        writeUrl({ [paramKey(urlStateKey, "page")]: p === 1 ? null : String(p) });
      } else {
        setLocalPage(p);
      }
    },
    [urlMode, urlStateKey, writeUrl]
  );

  return {
    filtered,
    sorted,
    paged,
    query,
    sortKey,
    sortDir,
    page,
    totalPages,
    setQuery,
    toggleSort,
    setPage,
    loading,
    columns,
  };
}
