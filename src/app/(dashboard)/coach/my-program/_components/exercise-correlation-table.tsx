"use client";

import { useState, useMemo } from "react";

interface ExerciseRow {
  exercise: string;
  type: string;
  correlation: number;
  absCorrelation: number;
  isInCurrentComplex: boolean;
  personalR: number | null;
  blendedR: number | null;
}

interface ExerciseCorrelationTableProps {
  exercises: ExerciseRow[];
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  CE: { label: "CE", color: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" },
  SD: { label: "SD", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" },
  SP: { label: "SP", color: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" },
  GP: { label: "GP", color: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" },
};

type SortKey = "exercise" | "correlation" | "absCorrelation" | "type";

export default function ExerciseCorrelationTable({
  exercises,
}: ExerciseCorrelationTableProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("absCorrelation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const filtered = useMemo(() => {
    let result = exercises;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.exercise.toLowerCase().includes(q));
    }
    if (filterType !== "all") {
      result = result.filter((e) => e.type === filterType);
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return result;
  }, [exercises, search, filterType, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const ariaSortValue = (col: SortKey): "ascending" | "descending" | "none" => {
    if (sortKey !== col) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent, col: SortKey) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleSort(col);
    }
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search exercises..."
          aria-label="Search exercises"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="input flex-1 text-sm"
        />
        <select
          value={filterType}
          aria-label="Filter by exercise type"
          onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
          className="input text-sm w-28"
        >
          <option value="all">All Types</option>
          <option value="CE">CE</option>
          <option value="SD">SD</option>
          <option value="SP">SP</option>
          <option value="GP">GP</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--muted-bg)] text-left">
              <th
                className="px-3 py-2 font-medium text-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-gold)]"
                tabIndex={0}
                role="columnheader"
                aria-sort={ariaSortValue("exercise")}
                onClick={() => toggleSort("exercise")}
                onKeyDown={(e) => handleHeaderKeyDown(e, "exercise")}
              >
                Exercise
                <svg className={`w-3 h-3 inline ml-0.5 ${sortKey === "exercise" ? "text-[var(--foreground)]" : "text-muted"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortKey === "exercise" && sortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>
              </th>
              <th className="px-3 py-2 font-medium text-muted w-16" role="columnheader">Type</th>
              <th
                className="px-3 py-2 font-medium text-muted cursor-pointer w-20 text-right focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-gold)]"
                tabIndex={0}
                role="columnheader"
                aria-sort={ariaSortValue("correlation")}
                onClick={() => toggleSort("correlation")}
                onKeyDown={(e) => handleHeaderKeyDown(e, "correlation")}
              >
                R
                <svg className={`w-3 h-3 inline ml-0.5 ${sortKey === "correlation" ? "text-[var(--foreground)]" : "text-muted"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortKey === "correlation" && sortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>
              </th>
              <th
                className="px-3 py-2 font-medium text-muted cursor-pointer w-20 text-right focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-gold)]"
                tabIndex={0}
                role="columnheader"
                aria-sort={ariaSortValue("absCorrelation")}
                onClick={() => toggleSort("absCorrelation")}
                onKeyDown={(e) => handleHeaderKeyDown(e, "absCorrelation")}
              >
                |R|
                <svg className={`w-3 h-3 inline ml-0.5 ${sortKey === "absCorrelation" ? "text-[var(--foreground)]" : "text-muted"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortKey === "absCorrelation" && sortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>
              </th>
              <th className="px-3 py-2 font-medium text-muted w-20 text-center" role="columnheader">In Complex</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No exercises found.
                </td>
              </tr>
            ) : (
              pageData.map((ex) => {
                const badge = TYPE_BADGES[ex.type];
                return (
                  <tr
                    key={ex.exercise}
                    className="border-t border-[var(--card-border)] hover:bg-[var(--muted-bg)]/50 transition-colors"
                  >
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {ex.exercise}
                      {ex.personalR !== null && (
                        <span className="text-[10px] text-muted ml-1.5">
                          personal={ex.personalR.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {badge && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {ex.correlation.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--foreground)]">
                      {ex.absCorrelation.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ex.isInCurrentComplex ? (
                        <span className="text-emerald-500 font-bold text-xs" aria-label="In current complex">
                          <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="sr-only">Not in current complex</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Result count (announced on change) */}
      <div aria-live="polite" aria-atomic="true" className="text-xs text-muted">
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""} found
        {search && ` for "${search}"`}
        {filterType !== "all" && ` (${filterType})`}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Exercise table pagination" className="flex items-center justify-between text-xs text-muted">
          <span aria-hidden="true">
            {filtered.length} exercise{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="px-2 py-1 rounded bg-[var(--muted-bg)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
            >
              Prev
            </button>
            <span aria-current="page">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
              className="px-2 py-1 rounded bg-[var(--muted-bg)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
