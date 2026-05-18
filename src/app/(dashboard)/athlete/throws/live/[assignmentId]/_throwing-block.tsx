"use client";

import { useState, useMemo, useRef } from "react";
import { Check, Trophy, Video } from "lucide-react";
import { AnimatedNumber, RestTimer } from "@/components";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { haptic } from "@/lib/haptic";
import { formatEventType, formatPreviousBestDate } from "@/lib/utils";
import type { BlockData, BlockState, LoggedThrow } from "./_types";
import {
  parseConfig,
  getThrowCount,
  getImplement,
  getImplementKg,
  getRestSeconds,
  getBlockAccent,
  CHAMFER,
  CHAMFER_LG,
} from "./_utils";

import { logger } from "@/lib/logger";
/* ═══════════════════════════════════════════════════════════════════════ */
/*  THROWING BLOCK VIEW                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

export function ThrowingBlockView({
  block,
  state,
  assignmentId,
  event,
  onThrowLogged,
}: {
  block: BlockData;
  state: BlockState;
  assignmentId: string;
  event: string;
  onThrowLogged: (t: LoggedThrow) => void;
}) {
  const { toast, celebration } = useToast();
  const [distance, setDistance] = useState("");
  const [logging, setLogging] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [prCelebration, setPrCelebration] = useState<{
    show: boolean;
    distance?: number;
  }>({ show: false });
  const videoInputRef = useRef<HTMLInputElement>(null);

  const accent = getBlockAccent(block);
  const cfg = parseConfig(block.config);
  const target = getThrowCount(cfg);
  const implement = getImplement(cfg);
  const implementKg = getImplementKg(cfg);
  const restSeconds = getRestSeconds(cfg);
  const technique = (cfg.techniqueFocus as string) || "FULL_THROW";
  const current = state.throws.length;
  const bestMark = useMemo(
    () =>
      state.throws
        .filter((t) => t.distance !== null)
        .reduce((max, t) => Math.max(max, t.distance as number), 0),
    [state.throws]
  );

  async function logThrow() {
    const d = parseFloat(distance);
    if (!d || d <= 0) {
      toast("Enter a valid distance", "error");
      return;
    }

    setLogging(true);
    try {
      const res = await fetch(`/api/throws/assignments/${assignmentId}/log-throw`, {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: csrfHeaders(),
        body: JSON.stringify({
          blockId: block.id,
          distance: d,
          implement: implement || `${implementKg}kg`,
          throwNumber: current + 1,
          event,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Failed to log throw", "error");
        return;
      }

      const logged: LoggedThrow = {
        id: data.data.throwLog.id,
        throwNumber: current + 1,
        distance: d,
        isPersonalBest: data.data.isPersonalBest,
      };
      onThrowLogged(logged);
      setDistance("");
      setInputExpanded(false);

      // Upload video to codex in the background if captured
      if (videoFile) {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("event", event);
        formData.append("implement", implement || `${implementKg}kg`);
        formData.append("distance", String(d));
        fetch("/api/codex", {
          method: "POST",
          headers: { ...csrfHeaders() },
          body: formData,
        })
          .then(() => {
            toast("Video saved to Codex", "success");
          })
          .catch(() => {
            toast("Video upload failed", "error");
          });
        setVideoFile(null);
      }

      // Show rest timer if restSeconds configured and throws remain
      if (restSeconds > 0 && current + 1 < target) {
        setShowRest(true);
      }

      if (data.data.isPersonalBest) {
        haptic.pr();
        setPrCelebration({ show: true, distance: d });
        const eventLabel = formatEventType(event);
        const previousBest: number | null = data.data.previousBest ?? null;
        const previousBestDate: string | null = data.data.previousBestDate ?? null;
        const description =
          previousBest != null
            ? `${implement || eventLabel} · +${(d - previousBest).toFixed(2)}m over your previous best${
                previousBestDate ? ` from ${formatPreviousBestDate(previousBestDate)}` : ""
              }`
            : `${implement || eventLabel} · First-ever PR for this implement`;
        celebration("New Personal Best!", {
          description,
          highlight: `${d.toFixed(2)}m`,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        toast("Connection slow — your throw will save when reception improves", "error");
      } else {
        toast("Network error — try again", "error");
      }
    } finally {
      setLogging(false);
    }
  }

  async function skipThrow() {
    try {
      const res = await fetch(`/api/throws/assignments/${assignmentId}/log-throw`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          blockId: block.id,
          distance: null,
          implement: implement || `${implementKg}kg`,
          throwNumber: current + 1,
          event,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Skip failed (${res.status})`);
      }
    } catch (err) {
      // Advance locally either way — blocking mid-session on a transient
      // network error is worse UX than a warning toast. But make the failure
      // visible so athlete + coach know the skip isn't persisted.
      logger.error("skipThrow persist failed", {
        context: "athlete/throws/live/[id]/throwing-block",
        error: err,
      });
      toast(err instanceof Error ? err.message : "Skip not saved — connection issue", "warning");
    }
    onThrowLogged({ throwNumber: current + 1, distance: null });
  }

  return (
    <div className="space-y-5">
      {/* ── Hero Throw Counter ── */}
      <div className="text-center pt-2">
        <p
          className="text-nano uppercase font-semibold mb-1"
          style={{ letterSpacing: "4px", color: `${accent}44` }}
        >
          THROW
        </p>
        <div
          className="flex items-baseline justify-center"
          style={{ textShadow: `0 0 50px ${accent}33` }}
        >
          <NumberFlow
            value={current + (current < target ? 1 : 0)}
            className="font-heading font-extrabold"
            style={{ fontSize: "72px", lineHeight: 1, color: accent }}
          />
          <span
            className="font-heading font-semibold ml-1"
            style={{ fontSize: "22px", color: `${accent}66` }}
          >
            /{target}
          </span>
        </div>
        {technique !== "FULL_THROW" && (
          <p className="text-xs mt-1 capitalize" style={{ color: `${accent}88` }}>
            {technique.replace(/_/g, " ").toLowerCase()}
          </p>
        )}
      </div>

      {/* ── Progress Grid ── */}
      <div className="flex flex-wrap justify-center gap-[3px]">
        {Array.from({ length: target }, (_, i) => {
          const num = i + 1;
          const logged = state.throws.find((t) => t.throwNumber === num);
          const isCurrent = num === current + 1 && current < target;
          const isDone = logged && logged.distance !== null;
          const isSkipped = logged && logged.distance === null;

          let bg = "#111";
          let fg = "#333";
          let label = String(num);

          if (isDone) {
            bg = "var(--palette-success-vivid)";
            fg = "#000";
            label = "\u2713";
          } else if (isSkipped) {
            bg = "#111";
            fg = "#555";
            label = "\u2014";
          } else if (isCurrent) {
            bg = accent;
            fg = "#000";
          }

          return (
            <div
              key={num}
              className="w-5 h-5 flex items-center justify-center font-semibold select-none"
              style={{
                fontSize: "7px",
                backgroundColor: bg,
                color: fg,
                clipPath: CHAMFER,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* ── Best Mark Badge ── */}
      {bestMark > 0 && (
        <div className="flex justify-end">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm"
            style={{ backgroundColor: `${accent}11`, border: `1px solid ${accent}22` }}
          >
            <span
              className="text-nano uppercase font-semibold"
              style={{ color: `${accent}88`, letterSpacing: "2px" }}
            >
              Best
            </span>
            <span style={{ color: accent }}>
              <AnimatedNumber
                value={bestMark}
                decimals={2}
                className="text-sm font-heading font-bold"
              />
            </span>
            <span className="text-xs" style={{ color: `${accent}66` }}>
              m
            </span>
          </div>
        </div>
      )}

      {/* ── Rest Timer ── */}
      {showRest && restSeconds > 0 && (
        <div className="flex flex-col items-center py-2">
          <RestTimer
            seconds={restSeconds}
            autoStart
            compact={false}
            onComplete={() => setShowRest(false)}
          />
          <button
            onClick={() => setShowRest(false)}
            className="mt-2 text-xs text-muted hover:text-[var(--foreground)] transition-colors min-h-[44px]"
          >
            Skip Rest
          </button>
        </div>
      )}

      {/* ── Distance Input Card ── */}
      {current < target && !showRest && (
        <>
          {!inputExpanded ? (
            <button
              onClick={() => setInputExpanded(true)}
              className="w-full min-h-[56px] flex items-center justify-center transition-colors"
              style={{
                backgroundColor: "#08080a",
                border: `1px solid ${accent}40`,
                clipPath: CHAMFER_LG,
              }}
            >
              <span
                className="text-nano uppercase font-bold"
                style={{ letterSpacing: "3px", color: `${accent}cc` }}
              >
                TAP TO LOG THROW #{current + 1}
              </span>
            </button>
          ) : (
            <div
              className="p-4 space-y-3"
              style={{
                backgroundColor: "#08080a",
                border: `1px solid ${accent}40`,
                clipPath: CHAMFER_LG,
              }}
            >
              <label
                className="text-nano uppercase font-semibold block"
                style={{ letterSpacing: "2px", color: `${accent}88` }}
              >
                Distance (m) — Throw #{current + 1}
              </label>
              {/* Hidden video input */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 200 * 1024 * 1024) {
                      toast("Video too large (max 200MB)", "error");
                      return;
                    }
                    setVideoFile(file);
                  }
                  e.target.value = "";
                }}
              />

              {/* Distance + LOG row */}
              <div className="flex gap-2 items-end">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") logThrow();
                    if (e.key === "Escape") setInputExpanded(false);
                  }}
                  placeholder="0.00"
                  className="flex-1 px-3 py-3 rounded-md border text-lg tabular-nums font-medium text-center focus-visible:outline-none"
                  style={{
                    backgroundColor: "#0a0a0c",
                    borderColor: `${accent}33`,
                    color: accent,
                  }}
                  autoFocus
                  inputMode="decimal"
                />
                <button
                  onClick={logThrow}
                  disabled={logging || !distance}
                  className="px-6 min-h-[48px] font-bold text-xs uppercase disabled:opacity-40 transition-opacity"
                  style={{
                    letterSpacing: "2px",
                    backgroundColor: accent,
                    color: "#000",
                    clipPath: CHAMFER_LG,
                  }}
                >
                  {logging ? "..." : "LOG"}
                </button>
              </div>

              {/* Video capture row */}
              <button
                onClick={() => videoInputRef.current?.click()}
                type="button"
                className="w-full min-h-[44px] flex items-center justify-center gap-2 transition-opacity"
                style={{
                  backgroundColor: videoFile ? `${accent}11` : "transparent",
                  border: `1px solid ${videoFile ? accent : `${accent}22`}`,
                  clipPath: CHAMFER_LG,
                }}
              >
                <Video
                  size={14}
                  strokeWidth={1.75}
                  style={{ color: videoFile ? accent : `${accent}66` }}
                  aria-hidden="true"
                />
                <span
                  className="text-nano font-bold uppercase"
                  style={{ letterSpacing: "2px", color: videoFile ? accent : `${accent}66` }}
                >
                  {videoFile ? "Video Attached ✓" : "Add Video"}
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Skip Button ── */}
      {current < target && !showRest && (
        <button
          onClick={skipThrow}
          className="w-full min-h-[44px] py-3 text-nano uppercase font-bold transition-colors"
          style={{
            letterSpacing: "3px",
            color: `${accent}88`,
            backgroundColor: "transparent",
            border: `1px solid ${accent}55`,
            clipPath: CHAMFER_LG,
          }}
        >
          SKIP (NO MARK)
        </button>
      )}

      {/* ── Logged Throws Mini-List ── */}
      {state.throws.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          {state.throws.map((t) => (
            <span
              key={t.throwNumber}
              className="text-xs tabular-nums"
              style={{ color: t.isPersonalBest ? "var(--color-brand)" : `${accent}88` }}
            >
              #{t.throwNumber} {t.distance !== null ? `${t.distance.toFixed(2)}m` : "\u2014"}
              {t.isPersonalBest && (
                <Trophy size={10} strokeWidth={1.75} className="inline ml-0.5" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Block Complete ── */}
      {current >= target && (
        <div
          className="text-center py-4"
          style={{
            backgroundColor: "#00FF8811",
            border: "1px solid #00FF8833",
            clipPath: CHAMFER_LG,
          }}
        >
          <Check
            size={20}
            strokeWidth={1.75}
            className="mx-auto mb-1"
            style={{ color: "var(--palette-success-vivid)" }}
            aria-hidden="true"
          />
          <p
            className="text-xs font-bold uppercase"
            style={{ letterSpacing: "3px", color: "var(--palette-success-vivid)" }}
          >
            Block Complete
          </p>
        </div>
      )}

      <PRCelebration
        show={prCelebration.show}
        onDismiss={() => setPrCelebration({ show: false })}
        event={event}
        distance={prCelebration.distance}
      />
    </div>
  );
}
