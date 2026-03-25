"use client";

import { useState, useMemo, useCallback } from "react";
import type { Column, SortDirection } from "./DataTable";

export interface UseDataTableOptions<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  loading?: boolean;
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

export function useDataTable<T extends Record<string, unknown>>(
  options: UseDataTableOptions<T>
): UseDataTableReturn<T> {
  const { data, columns, pageSize = 10, loading = false } = options;

  const [query, setQueryRaw] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [page, setPageRaw] = useState(1);

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
  const totalPages =
    pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const paged =
    pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  /* Actions */
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    setPageRaw(1);
  }, []);

  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
      setPageRaw(1);
    },
    [sortKey]
  );

  const setPage = useCallback((p: number) => {
    setPageRaw(p);
  }, []);

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
