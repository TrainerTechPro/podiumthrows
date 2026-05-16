"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LayoutGrid, Video } from "lucide-react";
import { DrillFilters } from "../throws/drills/_drill-filters";
import { DrillGrid } from "../throws/drills/_drill-grid";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventType } from "@/lib/utils";
import type { DrillItem } from "@/lib/data/coach";

const CATEGORY_LABELS: Record<string, string> = {
  CE: "Competitive Exercise",
  SDE: "Special Developmental",
  SPE: "Special Preparatory",
  GPE: "General Preparatory",
};

const DIFFICULTY_VARIANTS: Record<string, "success" | "warning" | "danger"> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "danger",
};

interface DrillVideoSummary {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  event: string | null;
  category: string | null;
  difficulty: string | null;
  isGlobal: boolean;
  coachId: string | null;
}

interface DrillsTabProps {
  drills: DrillItem[];
  drillVideos: DrillVideoSummary[];
  ownDrillCount: number;
  globalDrillCount: number;
}

type Mode = "cards" | "videos";

export function DrillsTab({
  drills,
  drillVideos,
  ownDrillCount,
  globalDrillCount,
}: DrillsTabProps) {
  const [mode, setMode] = useState<Mode>("cards");

  const counts = useMemo(
    () => ({
      cards: drills.length,
      videos: drillVideos.length,
    }),
    [drills.length, drillVideos.length]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted">
            {mode === "cards" ? (
              <>
                {drills.length} drill{drills.length !== 1 ? "s" : ""} •{" "}
                <span className="text-[var(--foreground)]">{ownDrillCount} yours</span> ·{" "}
                <span className="text-muted">{globalDrillCount} library</span>
              </>
            ) : (
              <>
                {drillVideos.length} drill{drillVideos.length !== 1 ? "s" : ""} with video
                demonstrations
              </>
            )}
          </p>
        </div>

        <div
          className="inline-flex items-center bg-[var(--muted-bg)] p-1 rounded-lg"
          role="tablist"
          aria-label="Drill view mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "cards"}
            onClick={() => setMode("cards")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "cards"
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-muted hover:text-[var(--foreground)]"
            }`}
          >
            <LayoutGrid size={14} strokeWidth={1.75} aria-hidden="true" />
            Cards <span className="text-muted">·{counts.cards}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "videos"}
            onClick={() => setMode("videos")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "videos"
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-muted hover:text-[var(--foreground)]"
            }`}
          >
            <Video size={14} strokeWidth={1.75} aria-hidden="true" />
            Videos <span className="text-muted">·{counts.videos}</span>
          </button>
        </div>
      </div>

      {mode === "cards" ? (
        <>
          <DrillFilters />
          <DrillGrid drills={drills} />
        </>
      ) : drillVideos.length === 0 ? (
        <EmptyState
          title="No drill videos yet"
          description="Attach demo footage to a drill in the Drills tab and it'll surface here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drillVideos.map((d) => (
            <Link
              key={d.id}
              href={`/coach/videos/drills`}
              className="card card-interactive !p-0 overflow-hidden flex flex-col"
            >
              <div className="w-full aspect-video bg-[var(--muted-bg)] flex items-center justify-center">
                <Video size={32} className="text-muted" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div className="p-3 space-y-2 flex-1">
                <h3 className="font-semibold text-sm text-[var(--foreground)] line-clamp-2">
                  {d.name}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {d.event && (
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wide">
                      {formatEventType(d.event)}
                    </span>
                  )}
                  {d.category && (
                    <Badge variant="primary">{CATEGORY_LABELS[d.category] ?? d.category}</Badge>
                  )}
                  {d.difficulty && (
                    <Badge variant={DIFFICULTY_VARIANTS[d.difficulty] ?? "primary"}>
                      {d.difficulty}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
