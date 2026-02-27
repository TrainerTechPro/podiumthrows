"use client";

import { useState } from "react";

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

interface Props {
  name: string;
  className?: string;
  children?: React.ReactNode;
}

export function ExerciseNameLink({ name, className, children }: Props) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setLoading(true);
    setNotFound(false);
    setDetail(null);

    try {
      const res = await fetch(`/api/exercise-library/lookup?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setDetail(data.data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }

  function getYouTubeEmbedUrl(url: string): string | null {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer underline decoration-dotted underline-offset-2 decoration-gray-300 dark:decoration-gray-600 hover:decoration-primary-400 ${className || ""}`}
        title="Tap to learn how to do this exercise"
      >
        {children || name}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div
              className="bg-white dark:bg-surface-950 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-surface-950 border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-start justify-between gap-3 rounded-t-2xl z-10">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-0.5">
                    Exercise Guide
                  </p>
                  <h2 className="text-lg font-heading font-bold text-gray-900 dark:text-white leading-tight">
                    {name}
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-surface-800 min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {loading ? (
                  <div className="space-y-4 py-4">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
                    </div>
                    <p className="text-sm text-gray-400 text-center">Looking up exercise...</p>
                  </div>
                ) : notFound ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      Not found in the exercise library
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      This exercise hasn&apos;t been added to the reference library yet. Ask your coach for guidance on proper form.
                    </p>
                  </div>
                ) : detail ? (
                  <>
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold">
                        {detail.muscleGroup}
                      </span>
                      {detail.equipment && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {detail.equipment}
                        </span>
                      )}
                      {detail.mechanics && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{detail.mechanics}</span>
                      )}
                      {detail.force && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{detail.force}</span>
                      )}
                    </div>

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
                      <a
                        href={detail.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span className="text-sm font-medium">Watch Video Demo</span>
                      </a>
                    ) : null}

                    {/* Target muscles */}
                    {detail.target.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                          Target Muscles
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.target.map((m) => (
                            <span key={m} className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.synergists.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                          Synergist Muscles
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.synergists.map((m) => (
                            <span key={m} className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preparation */}
                    {detail.preparation && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Setup / Preparation
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-surface-800 rounded-xl px-4 py-3">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {detail.preparation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Execution */}
                    {detail.execution && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Execution / Movement
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-surface-800 rounded-xl px-4 py-3">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {detail.execution}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tips */}
                    {detail.tips && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Tips & Notes
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-surface-800 rounded-xl px-4 py-3">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {detail.tips}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
