"use client";

import { useState, useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface CodexEntry {
  id: string;
  event: string;
  implement: string;
  distance: number;
  videoUrl: string;
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

/* ─── Upload Form ──────────────────────────────────────────────────────────── */

function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [event, setEvent] = useState("SHOT_PUT");
  const [implement, setImplement] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [thrownAt, setThrownAt] = useState(new Date().toISOString().split("T")[0]);
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

    const fd = new FormData();
    fd.append("video", file);
    fd.append("event", event);
    fd.append("implement", implement);
    fd.append("distance", distance);
    fd.append("thrownAt", thrownAt);
    if (notes.trim()) fd.append("notes", notes.trim());

    // Use XHR for upload progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/codex");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setFile(null);
        setImplement("");
        setDistance("");
        setNotes("");
        if (fileRef.current) fileRef.current.value = "";
        onSuccess();
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          setError(data.error || "Upload failed");
        } catch {
          setError("Upload failed");
        }
      }
      setUploading(false);
    };

    xhr.onerror = () => {
      setError("Network error — check your connection");
      setUploading(false);
    };

    xhr.send(fd);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <h2 className="font-heading font-semibold text-base text-[var(--foreground)]">
        Log a Throw
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Event */}
        <div>
          <label htmlFor="codex-event" className="label">Event</label>
          <select
            id="codex-event"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            className="input"
          >
            {EVENTS.map((ev) => (
              <option key={ev.value} value={ev.value}>{ev.label}</option>
            ))}
          </select>
        </div>

        {/* Implement */}
        <div>
          <label htmlFor="codex-implement" className="label">Implement</label>
          <input
            id="codex-implement"
            type="text"
            value={implement}
            onChange={(e) => setImplement(e.target.value)}
            className="input"
            placeholder="7.26kg"
            required
          />
        </div>

        {/* Distance */}
        <div>
          <label htmlFor="codex-distance" className="label">Distance (m)</label>
          <input
            id="codex-distance"
            type="number"
            step="0.01"
            min="0"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="input"
            placeholder="18.50"
            required
          />
        </div>

        {/* Date */}
        <div>
          <label htmlFor="codex-date" className="label">Date</label>
          <input
            id="codex-date"
            type="date"
            value={thrownAt}
            onChange={(e) => setThrownAt(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {/* Video file */}
      <div>
        <label htmlFor="codex-video" className="label">Video</label>
        <input
          ref={fileRef}
          id="codex-video"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary-500/10 file:text-primary-600 dark:file:text-primary-400 file:font-medium file:text-sm file:cursor-pointer"
          required
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="codex-notes" className="label">Notes (optional)</label>
        <input
          id="codex-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input"
          placeholder="Felt smooth, good hip rotation..."
        />
      </div>

      {error && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted text-right">{progress}%</p>
        </div>
      )}

      <button
        type="submit"
        disabled={uploading || !file || !implement || !distance}
        className="btn-primary w-full sm:w-auto"
      >
        {uploading ? "Uploading..." : "Upload Throw"}
      </button>
    </form>
  );
}

/* ─── Codex Grid ───────────────────────────────────────────────────────────── */

function CodexGrid({
  entries,
  onDelete,
}: {
  entries: CodexEntry[];
  onDelete: (id: string) => void;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this throw? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/codex/${id}`, { method: "DELETE" });
      if (res.ok) onDelete(id);
    } catch {
      alert("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <div key={entry.id} className="card overflow-hidden group">
          {/* Video */}
          <div
            className="relative aspect-video bg-surface-950 cursor-pointer"
            onClick={() => setPlayingId(playingId === entry.id ? null : entry.id)}
          >
            {playingId === entry.id ? (
              <video
                src={entry.videoUrl}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <video
                  src={entry.videoUrl}
                  className="w-full h-full object-contain"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-surface-800/90 flex items-center justify-center shadow-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-surface-900 dark:text-surface-100 ml-0.5" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="p-4 space-y-3">
            {/* Top row: distance + implement */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-heading font-bold text-xl text-[var(--foreground)] tabular-nums">
                {entry.distance.toFixed(2)}m
              </span>
              <span className="font-heading text-sm font-semibold text-muted tabular-nums">
                {entry.implement}
              </span>
            </div>

            {/* Event + date */}
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${EVENT_COLORS[entry.event] ?? ""}`}>
                {eventLabel(entry.event)}
              </span>
              <span className="text-xs text-muted">
                {formatDate(entry.thrownAt)}
              </span>
            </div>

            {/* Notes */}
            {entry.notes && (
              <p className="text-xs text-muted leading-relaxed line-clamp-2">
                {entry.notes}
              </p>
            )}

            {/* Delete */}
            <button
              onClick={() => handleDelete(entry.id)}
              disabled={deletingId === entry.id}
              className="text-[11px] text-muted hover:text-danger-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              {deletingId === entry.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ))}
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
      setSortOrder(field === "distance" ? "desc" : "desc");
    }
  }

  // Collect unique implements for weight filter summary
  const uniqueImplements = [...new Set(entries.map((e) => e.implement))].sort(
    (a, b) => parseFloat(b) - parseFloat(a)
  );

  return (
    <div className="space-y-6 animate-spring-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
            Throws Codex
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Your personal throw video archive — sortable by date, weight, or distance
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

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Event filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterEvent("")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
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
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                filterEvent === ev.value
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                  : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
              }`}
            >
              {ev.label}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <span className="text-xs text-muted mr-1">Sort:</span>
          {([
            ["thrownAt", "Date"],
            ["implement", "Weight"],
            ["distance", "Distance"],
          ] as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                sortField === field
                  ? "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {label}
              {sortField === field && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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

      {/* Stats bar */}
      {entries.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>{entries.length} throw{entries.length !== 1 ? "s" : ""}</span>
          {uniqueImplements.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-surface-400" aria-hidden="true" />
              {uniqueImplements.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card overflow-hidden">
              <div className="aspect-video shimmer" />
              <div className="p-4 space-y-3">
                <div className="shimmer h-6 w-24 rounded" />
                <div className="shimmer h-4 w-32 rounded" />
              </div>
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
      ) : (
        <CodexGrid
          entries={entries}
          onDelete={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
        />
      )}
    </div>
  );
}
