"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";

// ─── Types ──────────────────────────────────────────────────────────
interface ExerciseListItem {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  target: string[];
  videoUrl: string | null;
}

interface ExerciseDetail {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  target: string[];
  synergists: string[];
  stabilizers: string[];
  preparation: string | null;
  execution: string | null;
  tips: string | null;
  force: string | null;
  mechanics: string | null;
  utility: string | null;
  videoUrl: string | null;
  videoEmbed: string | null;
}

interface FilterData {
  muscleGroups: string[];
  equipments: string[];
  total: number;
}

interface Props {
  isCoach: boolean;
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ExerciseLibraryPage({ isCoach }: Props) {
  const { toast } = useToast();
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [filters, setFilters] = useState<FilterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // ─── Load filters on mount ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/exercise-library/filters")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setFilters(data.data);
          if (data.data.total === 0) setNeedsSeed(true);
        }
      })
      .catch(() => {});
  }, []);

  // ─── Fetch exercises ────────────────────────────────────────────
  const fetchExercises = useCallback(
    async (s: string, mg: string, eq: string, p: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (mg) params.set("muscleGroup", mg);
      if (eq) params.set("equipment", eq);
      params.set("page", String(p));
      params.set("limit", "30");

      try {
        const res = await fetch(`/api/exercise-library?${params}`);
        const data = await res.json();
        if (data.success) {
          setExercises(data.data.exercises);
          setTotalPages(data.data.totalPages);
          setTotal(data.data.total);
          if (data.data.total === 0 && !s && !mg && !eq) setNeedsSeed(true);
        }
      } catch {
        toast("Failed to load exercises", "error");
      }
      setLoading(false);
    },
    [toast]
  );

  useEffect(() => {
    fetchExercises(search, muscleGroup, equipment, page);
  }, [muscleGroup, equipment, page, fetchExercises]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchExercises(value, muscleGroup, equipment, 1);
    }, 300);
  }

  function handleMuscleGroupChange(mg: string) {
    setMuscleGroup(mg);
    setPage(1);
  }

  function handleEquipmentChange(eq: string) {
    setEquipment(eq);
    setPage(1);
  }

  // ─── Fetch detail ──────────────────────────────────────────────
  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/exercise-library/${id}`);
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch {
      toast("Failed to load exercise details", "error");
    }
    setDetailLoading(false);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  // ─── Seed library ─────────────────────────────────────────────
  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/exercise-library/seed", { method: "POST", headers: csrfHeaders() });
      const data = await res.json();
      if (data.success) {
        toast(data.data.message, "success");
        setNeedsSeed(false);
        // Reload filters and exercises
        const [filtersRes] = await Promise.all([
          fetch("/api/exercise-library/filters").then((r) => r.json()),
        ]);
        if (filtersRes.success) setFilters(filtersRes.data);
        fetchExercises(search, muscleGroup, equipment, 1);
      } else {
        toast(data.error || "Failed to seed", "error");
      }
    } catch {
      toast("Failed to seed exercise library", "error");
    }
    setSeeding(false);
  }

  // ─── Empty state ──────────────────────────────────────────────
  if (needsSeed && !loading && exercises.length === 0) {
    return (
      <div className="animate-spring-up">
        <div className="mb-6">
          <h1 className="text-display font-heading text-gray-900 dark:text-white">
            Exercise Reference Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            1,780+ exercises with detailed instructions and muscle targeting
          </p>
        </div>
        <div className="card text-center py-16">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-2">
            Exercise Library Not Populated Yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
            Load 1,780+ exercises covering 12 muscle groups with detailed setup instructions, execution cues, target muscles, synergists, and stabilizers.
          </p>
          {isCoach ? (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="btn-primary px-6 py-2.5 text-base"
            >
              {seeding ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading exercises...
                </span>
              ) : (
                "Populate Exercise Library"
              )}
            </button>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Ask your coach to populate the exercise library.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-spring-up">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-display font-heading text-gray-900 dark:text-white">
            Exercise Reference Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total > 0 ? `${total.toLocaleString()} exercises` : "Loading..."} — search, filter, and learn proper form
          </p>
        </div>
      </div>

      {/* ─── Search + Filters ──────────────────────────────────── */}
      <div className="card mb-4 !p-3 sm:!p-4">
        {/* Search bar */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="input pl-10 py-2.5"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search exercises by name, muscle, or equipment..."
          />
          {search && (
            <button
              onClick={() => { setSearch(""); fetchExercises("", muscleGroup, equipment, 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Muscle group filter pills */}
        {filters && (
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                Muscle Group
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleMuscleGroupChange("")}
                  className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                    !muscleGroup
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold ring-1 ring-primary-200 dark:ring-primary-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  All
                </button>
                {filters.muscleGroups.map((mg) => (
                  <button
                    key={mg}
                    onClick={() => handleMuscleGroupChange(mg === muscleGroup ? "" : mg)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                      muscleGroup === mg
                        ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold ring-1 ring-primary-200 dark:ring-primary-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    {mg}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment filter */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                Equipment
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleEquipmentChange("")}
                  className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                    !equipment
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold ring-1 ring-primary-200 dark:ring-primary-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  All
                </button>
                {filters.equipments.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => handleEquipmentChange(eq === equipment ? "" : eq)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                      equipment === eq
                        ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold ring-1 ring-primary-200 dark:ring-primary-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Active filter summary ──────────────────────────────── */}
      {(search || muscleGroup || equipment) && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
          <span>
            {total.toLocaleString()} result{total !== 1 ? "s" : ""}
          </span>
          {muscleGroup && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 text-xs font-medium">
              {muscleGroup}
              <button onClick={() => handleMuscleGroupChange("")} className="hover:text-primary-900 dark:hover:text-primary-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          )}
          {equipment && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-medium">
              {equipment}
              <button onClick={() => handleEquipmentChange("")} className="hover:text-blue-900 dark:hover:text-blue-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs font-medium">
              &ldquo;{search}&rdquo;
              <button onClick={() => { setSearch(""); fetchExercises("", muscleGroup, equipment, 1); }} className="hover:text-gray-900 dark:hover:text-gray-100">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          )}
          <button
            onClick={() => { setSearch(""); setMuscleGroup(""); setEquipment(""); setPage(1); fetchExercises("", "", "", 1); }}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline ml-auto"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ─── Exercise Grid ──────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card !p-4 space-y-2">
              <div className="shimmer-contextual h-5 w-3/4 rounded" />
              <div className="flex gap-1.5">
                <div className="shimmer-contextual h-5 w-16 rounded-full" />
                <div className="shimmer-contextual h-5 w-20 rounded-full" />
              </div>
              <div className="shimmer-contextual h-4 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : exercises.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No exercises found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => openDetail(ex.id)}
                className="card !p-4 text-left group hover:ring-1 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-400 leading-snug line-clamp-2">
                    {ex.name}
                  </h3>
                  {ex.videoUrl && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center" title="Has video">
                      <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 font-medium">
                    {ex.muscleGroup}
                  </span>
                  {ex.equipment && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {ex.equipment}
                    </span>
                  )}
                </div>
                {ex.target.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-1">
                    {ex.target.join(", ")}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────── */}
      {selectedId && (
        <ExerciseDetailModal
          detail={detail}
          loading={detailLoading}
          isCoach={isCoach}
          onClose={closeDetail}
          onUpdate={(updated) => {
            setDetail(updated);
            toast("Exercise updated", "success");
          }}
        />
      )}
    </div>
  );
}

// ─── Exercise Detail Modal ──────────────────────────────────────────
function ExerciseDetailModal({
  detail,
  loading,
  isCoach,
  onClose,
  onUpdate,
}: {
  detail: ExerciseDetail | null;
  loading: boolean;
  isCoach: boolean;
  onClose: () => void;
  onUpdate: (d: ExerciseDetail) => void;
}) {
  const { toast } = useToast();
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset video form when detail changes
  useEffect(() => {
    if (detail) {
      setVideoUrl(detail.videoUrl || "");
      setEditingVideo(false);
    }
  }, [detail]);

  async function saveVideo() {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/exercise-library/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ videoUrl: videoUrl || null }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdate({ ...detail, videoUrl: videoUrl || null });
        setEditingVideo(false);
      } else {
        toast("Failed to save video link", "error");
      }
    } catch {
      toast("Failed to save video link", "error");
    }
    setSaving(false);
  }

  // Extract YouTube embed URL
  function getYouTubeEmbedUrl(url: string): string | null {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div
          className="bg-white dark:bg-surface-950 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-surface-950 border-b border-gray-100 dark:border-gray-800 px-5 sm:px-6 py-4 flex items-start justify-between gap-3 rounded-t-2xl z-10">
            <div className="min-w-0">
              {loading ? (
                <div className="shimmer-contextual h-6 w-48 rounded" />
              ) : detail ? (
                <>
                  <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white leading-tight">
                    {detail.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold">
                      {detail.muscleGroup}
                    </span>
                    {detail.equipment && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {detail.equipment}
                      </span>
                    )}
                    {detail.force && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {detail.force}
                      </span>
                    )}
                    {detail.mechanics && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {detail.mechanics}
                      </span>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-surface-800 min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="shimmer-contextual h-4 w-24 rounded mb-2" />
                    <div className="shimmer-contextual h-16 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : detail ? (
              <>
                {/* Video */}
                {detail.videoUrl && getYouTubeEmbedUrl(detail.videoUrl) ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Video Demo
                    </p>
                    <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-800">
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={getYouTubeEmbedUrl(detail.videoUrl)!}
                        title={`${detail.name} demo`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : detail.videoUrl ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Video Demo
                    </p>
                    <a
                      href={detail.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span className="text-sm font-medium">Watch Video</span>
                    </a>
                  </div>
                ) : null}

                {/* Coach: Add/Edit Video */}
                {isCoach && (
                  <div>
                    {editingVideo ? (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          className="input flex-1 text-sm"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="Paste YouTube URL..."
                        />
                        <button onClick={saveVideo} disabled={saving} className="btn-primary text-sm px-3">
                          {saving ? "..." : "Save"}
                        </button>
                        <button onClick={() => setEditingVideo(false)} className="btn-secondary text-sm px-3">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingVideo(true)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        {detail.videoUrl ? "Edit video link" : "Add YouTube video link"}
                      </button>
                    )}
                  </div>
                )}

                {/* Target Muscles */}
                {detail.target.length > 0 && (
                  <MuscleSection label="Target Muscles" muscles={detail.target} color="red" />
                )}
                {detail.synergists.length > 0 && (
                  <MuscleSection label="Synergist Muscles" muscles={detail.synergists} color="blue" />
                )}
                {detail.stabilizers.length > 0 && (
                  <MuscleSection label="Stabilizer Muscles" muscles={detail.stabilizers} color="gray" />
                )}

                {/* Preparation */}
                {detail.preparation && (
                  <InstructionSection label="Setup / Preparation" text={detail.preparation} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                )}

                {/* Execution */}
                {detail.execution && (
                  <InstructionSection label="Execution / Movement" text={detail.execution} icon="M13 10V3L4 14h7v7l9-11h-7z" />
                )}

                {/* Tips */}
                {detail.tips && (
                  <InstructionSection label="Tips & Notes" text={detail.tips} icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Muscle Section Sub-component ───────────────────────────────────
function MuscleSection({ label, muscles, color }: { label: string; muscles: string[]; color: "red" | "blue" | "gray" }) {
  const colorMap = {
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {muscles.map((m) => (
          <span key={m} className={`text-xs px-2.5 py-1 rounded-full font-medium ${colorMap[color]}`}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Instruction Section Sub-component ──────────────────────────────
function InstructionSection({ label, text, icon }: { label: string; text: string; icon: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <div className="bg-gray-50 dark:bg-surface-800 rounded-xl px-4 py-3">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>
    </div>
  );
}
