"use client";

import { useState, useEffect, useRef } from "react";
import { localToday } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface CodexEntry {
  id: string;
  event: string;
  implement: string;
  distance: number;
  videoUrl: string;
  thumbnailUrl: string | null;
  notes: string | null;
  thrownAt: string;
  createdAt: string;
}

type SortField = "thrownAt" | "implement" | "distance";
type SortOrder = "asc" | "desc";

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const EVENT_DOT: Record<string, string> = {
  SHOT_PUT: "bg-blue-500",
  DISCUS: "bg-purple-500",
  HAMMER: "bg-red-500",
  JAVELIN: "bg-green-500",
};

const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DISCUS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  HAMMER: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  JAVELIN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function eventLabel(e: string) {
  return EVENTS.find((ev) => ev.value === e)?.label ?? e;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/* ─── Upload Form ──────────────────────────────────────────────────────────── */

function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [event, setEvent] = useState("SHOT_PUT");
  const [implement, setImplement] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [thrownAt, setThrownAt] = useState(localToday());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !implement || !distance) return;
    setError("");
    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get upload URL from server
      const urlRes = await fetch("/api/codex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "upload-url",
          fileName: file.name || "video.mp4",
          contentType: file.type || "video/mp4",
          fileSizeMb: file.size / (1024 * 1024),
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "Failed to get upload URL");

      const videoUrl = urlData.publicUrl as string;

      // Step 2: Upload video
      if (urlData.mode === "r2") {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", urlData.uploadUrl);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
          xhr.onerror = () => reject(new Error("Network error — check your connection"));
          xhr.send(file);
        });

        // Step 3: Confirm and save metadata
        const confirmRes = await fetch("/api/codex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "confirm",
            event,
            implement,
            distance: parseFloat(distance),
            videoUrl,
            fileSize: file.size,
            notes: notes.trim() || null,
            thrownAt,
          }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmData.error || "Failed to save entry");
      } else {
        // Local dev: upload via FormData
        const fd = new FormData();
        fd.append("video", file);
        fd.append("event", event);
        fd.append("implement", implement);
        fd.append("distance", distance);
        fd.append("thrownAt", thrownAt);
        if (notes.trim()) fd.append("notes", notes.trim());

        const localRes = await new Promise<Response>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/codex");
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
          };
          xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(fd);
        });

        const localData = await localRes.json();
        if (!localRes.ok) throw new Error(localData.error || "Upload failed");
      }

      resetForm();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setFile(null);
    setImplement("");
    setDistance("");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h2 className="font-heading font-semibold text-base text-[var(--foreground)]">
        Log a Throw
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="codex-event" className="label">Event</label>
          <select id="codex-event" value={event} onChange={(e) => setEvent(e.target.value)} className="input">
            {EVENTS.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="codex-implement" className="label">Implement</label>
          <input id="codex-implement" type="text" value={implement} onChange={(e) => setImplement(e.target.value)} className="input" placeholder="7.26kg" required />
        </div>
        <div>
          <label htmlFor="codex-distance" className="label">Distance (m)</label>
          <input id="codex-distance" type="number" step="0.01" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} className="input" placeholder="18.50" required />
        </div>
        <div>
          <label htmlFor="codex-date" className="label">Date</label>
          <input id="codex-date" type="date" value={thrownAt} onChange={(e) => setThrownAt(e.target.value)} className="input" />
        </div>
      </div>

      <div>
        <label htmlFor="codex-video" className="label">Video</label>
        <input
          ref={fileRef}
          id="codex-video"
          type="file"
          accept="video/*,.mp4,.mov,.webm,.m4v,.3gp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary-500/10 file:text-primary-600 dark:file:text-primary-400 file:font-medium file:text-sm file:cursor-pointer"
          required
        />
      </div>

      <div>
        <label htmlFor="codex-notes" className="label">Notes (optional)</label>
        <input id="codex-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Felt smooth, good hip rotation..." />
      </div>

      {error && <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>}

      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden">
            <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted text-right">{progress}%</p>
        </div>
      )}

      <button type="submit" disabled={uploading || !file || !implement || !distance} className="btn-primary w-full sm:w-auto">
        {uploading ? "Uploading..." : "Upload Throw"}
      </button>
    </form>
  );
}

/* ─── Expanded Video Player ─────────────────────────────────────────────────── */

function VideoPlayer({ entry, onDelete }: { entry: CodexEntry; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this throw? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/codex/${entry.id}`, { method: "DELETE" });
      if (res.ok) onDelete();
    } catch {
      alert("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-4 pb-4 pt-1 space-y-3 animate-in slide-in-from-top-2 duration-200">
      <div className="bg-surface-950 rounded-xl overflow-hidden max-w-2xl">
        <video
          src={entry.videoUrl}
          className="w-full max-h-[70vh] object-contain"
          controls
          autoPlay
          playsInline
        />
      </div>
      {entry.notes && (
        <p className="text-sm text-muted leading-relaxed max-w-2xl">{entry.notes}</p>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-muted hover:text-danger-500 transition-colors"
      >
        {deleting ? "Deleting..." : "Delete throw"}
      </button>
    </div>
  );
}

/* ─── Codex List ───────────────────────────────────────────────────────────── */

function CodexList({
  entries,
  onDelete,
}: {
  entries: CodexEntry[];
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="card overflow-hidden divide-y divide-[var(--card-border)]">
      {/* Desktop header */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_100px_90px_100px] gap-4 px-4 py-2.5 bg-surface-50 dark:bg-surface-900/50">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Event</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted text-right">Distance</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted text-right">Weight</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted text-right">Date</span>
      </div>

      {entries.map((entry) => {
        const isExpanded = expandedId === entry.id;
        return (
          <div key={entry.id}>
            {/* Row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              className={`w-full text-left transition-colors ${
                isExpanded
                  ? "bg-surface-50 dark:bg-surface-900/40"
                  : "hover:bg-surface-50/60 dark:hover:bg-surface-900/20"
              }`}
            >
              {/* Desktop row */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_100px_90px_100px] gap-4 px-4 py-3 items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_DOT[entry.event] ?? "bg-surface-400"}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${EVENT_COLORS[entry.event] ?? ""}`}>
                    {eventLabel(entry.event)}
                  </span>
                  {entry.notes && (
                    <span className="text-xs text-muted truncate">{entry.notes}</span>
                  )}
                </div>
                <span className="font-heading font-bold text-sm text-[var(--foreground)] tabular-nums text-right">
                  {entry.distance.toFixed(2)}m
                </span>
                <span className="text-sm text-muted tabular-nums text-right font-medium">
                  {entry.implement}
                </span>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs text-muted">{formatDate(entry.thrownAt)}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-muted shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>

              {/* Mobile row */}
              <div className="sm:hidden px-4 py-3 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_DOT[entry.event] ?? "bg-surface-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading font-bold text-sm text-[var(--foreground)] tabular-nums">
                      {entry.distance.toFixed(2)}m
                    </span>
                    <span className="text-xs text-muted font-medium tabular-nums">{entry.implement}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${EVENT_COLORS[entry.event] ?? ""}`}>
                      {eventLabel(entry.event)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted">{formatDateShort(entry.thrownAt)}</span>
                    {entry.notes && (
                      <span className="text-[11px] text-muted truncate">{entry.notes}</span>
                    )}
                  </div>
                </div>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-muted shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>

            {/* Expanded video player */}
            {isExpanded && (
              <VideoPlayer
                entry={entry}
                onDelete={() => onDelete(entry.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main View ────────────────────────────────────────────────────────────── */

export function CodexView() {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("thrownAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterEvent, setFilterEvent] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");

  function fetchEntries() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("sort", sortField);
    params.set("order", sortOrder);
    if (filterEvent) params.set("event", filterEvent);

    fetch(`/api/codex?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEntries(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortOrder, filterEvent]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  // Client-side search over notes, implement, distance
  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return (
          e.implement.toLowerCase().includes(q) ||
          e.distance.toFixed(2).includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          eventLabel(e.event).toLowerCase().includes(q)
        );
      })
    : entries;

  // Stats
  const uniqueImplements = [...new Set(entries.map((e) => e.implement))].sort(
    (a, b) => parseFloat(b) - parseFloat(a)
  );
  const bestThrow = entries.length > 0 ? Math.max(...entries.map((e) => e.distance)) : 0;

  return (
    <div className="space-y-5 animate-spring-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
            Throws Codex
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {entries.length} throw{entries.length !== 1 ? "s" : ""} logged
            {bestThrow > 0 && <> &middot; best: {bestThrow.toFixed(2)}m</>}
            {uniqueImplements.length > 0 && <> &middot; {uniqueImplements.join(", ")}</>}
          </p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="btn-primary whitespace-nowrap"
        >
          {showUpload ? "Hide Form" : "+ Log Throw"}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <UploadForm
          onSuccess={() => {
            fetchEntries();
            setShowUpload(false);
          }}
        />
      )}

      {/* Controls bar */}
      {entries.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search throws..."
              className="input pl-9 text-sm h-8"
            />
          </div>

          {/* Event filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setFilterEvent("")}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                !filterEvent
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                  : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
              }`}
            >
              All
            </button>
            {EVENTS.map((ev) => (
              <button
                key={ev.value}
                onClick={() => setFilterEvent(filterEvent === ev.value ? "" : ev.value)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  filterEvent === ev.value
                    ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                    : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT[ev.value]}`} />
                {ev.label}
              </button>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-1 sm:ml-auto">
            <span className="text-xs text-muted mr-0.5">Sort:</span>
            {([
              ["thrownAt", "Date"],
              ["implement", "Weight"],
              ["distance", "Distance"],
            ] as [SortField, string][]).map(([field, label]) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  sortField === field
                    ? "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    : "text-muted hover:text-[var(--foreground)]"
                }`}
              >
                {label}
                {sortField === field && (
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    className={sortOrder === "asc" ? "rotate-180" : ""}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="card overflow-hidden divide-y divide-[var(--card-border)]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <div className="shimmer w-2 h-2 rounded-full" />
              <div className="shimmer h-4 w-16 rounded" />
              <div className="shimmer h-4 w-12 rounded" />
              <div className="shimmer h-4 w-14 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
          title="No throws logged yet"
          description="Upload your first throw video with distance and implement weight to start building your codex."
          action={
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              + Log Your First Throw
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted">No throws match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="text-xs text-primary-600 dark:text-primary-400 mt-2 hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <CodexList
          entries={filtered}
          onDelete={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
        />
      )}
    </div>
  );
}
