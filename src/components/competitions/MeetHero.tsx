"use client";

import { useCallback, useRef, useState } from "react";
import { Trophy, ArrowUp, ArrowDown, Minus, Share2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

/* ─── Hero card answering "how did I do?" in two seconds ──────────────────
   Reads heaviest, top-of-page. Big distance, event chip, place if any,
   delta vs season-best, single-tap share. The throws editor below is for
   correcting per-attempt details — this anchor is the result.
   ────────────────────────────────────────────────────────────────────── */

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const ORDINAL_SUFFIX = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

function formatDistance(m: number | null): string {
  if (m == null) return "—";
  return parseFloat(m.toFixed(2)).toString();
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${Math.abs(delta).toFixed(2)}m`;
}

function athleteName(athlete: { firstName: string; lastName: string } | null): string {
  if (!athlete) return "Athlete";
  return `${athlete.firstName} ${athlete.lastName}`.trim();
}

interface MeetHeroProps {
  meetName: string;
  date: string; // YYYY-MM-DD
  event: string;
  bestDistance: number | null;
  seasonBestDistance: number | null;
  /** Does the best throw match the all-time PB? Triggers the medal. */
  isPersonalBest: boolean;
  placeFinish: number | null;
  athlete: { firstName: string; lastName: string } | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ";
}

export function MeetHero({
  meetName,
  date,
  event,
  bestDistance,
  seasonBestDistance,
  isPersonalBest,
  placeFinish,
  athlete,
  meetStatus,
}: MeetHeroProps) {
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const eventLabel = EVENT_LABEL[event] ?? event;
  const dateObj = new Date(`${date}T00:00:00`);
  const formattedDate = Number.isNaN(dateObj.getTime())
    ? date
    : dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const delta =
    bestDistance != null && seasonBestDistance != null ? bestDistance - seasonBestDistance : null;
  const deltaState =
    delta == null
      ? ("none" as const)
      : delta > 0.005
        ? ("up" as const)
        : delta < -0.005
          ? ("down" as const)
          : ("flat" as const);

  const handleShare = useCallback(async () => {
    if (bestDistance == null) return;
    setSharing(true);
    try {
      const dataUrl = await renderShareCardPng({
        meetName,
        formattedDate,
        eventLabel,
        bestDistance,
        delta,
        athleteName: athleteName(athlete),
        isPersonalBest,
        placeFinish,
      });

      // Try the Web Share API first — gets the iOS/Android share sheet, which
      // beats a download every time. Falls back to download for desktop.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `meet-${meetName.toLowerCase().replace(/\s+/g, "-")}.png`, {
        type: "image/png",
      });

      type NavigatorWithShare = Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      const nav = navigator as NavigatorWithShare;
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${eventLabel} — ${formatDistance(bestDistance)}m`,
          text: `${meetName} · ${formattedDate}`,
        });
        toast.success("Shared", "Result card sent to your share sheet.");
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = file.name;
        link.click();
        toast.success("Downloaded", "Result card saved as PNG.");
      }
    } catch (err) {
      // AbortError fires when the user dismisses the iOS share sheet — that's
      // a user gesture, not a failure. Stay silent.
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.toLowerCase().includes("abort"));
      if (!isAbort) {
        logger.warn("share card render failed", {
          context: "competitions/MeetHero",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
        toast.error("Couldn't share", "Try again or take a screenshot.");
      }
    } finally {
      setSharing(false);
    }
  }, [
    meetName,
    formattedDate,
    eventLabel,
    bestDistance,
    delta,
    athlete,
    isPersonalBest,
    placeFinish,
    toast,
  ]);

  // Non-finishing statuses get a softer, status-forward variant.
  if (meetStatus !== "COMPLETED") {
    return (
      <div
        ref={cardRef}
        className="card p-6 bg-[var(--card-bg)] border border-[var(--card-border)] space-y-2"
      >
        <p className="text-xs font-mono uppercase tracking-wider text-muted">
          {eventLabel} · {formattedDate}
        </p>
        <h2 className="font-heading text-2xl text-[var(--foreground)]">{meetName}</h2>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning-500/15 text-warning-600 dark:text-warning-400">
          {meetStatus === "DNS"
            ? "Did not start"
            : meetStatus === "DNF"
              ? "Did not finish"
              : "Disqualified"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      data-testid="meet-hero"
      className="card p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-[var(--card-bg)] to-primary-500/5 border border-[var(--card-border)]"
    >
      {/* Header line: event · date · place */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted">
          <span>{eventLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{formattedDate}</span>
          {placeFinish != null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-primary-500 font-semibold">
                {placeFinish}
                {ORDINAL_SUFFIX(placeFinish)} place
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing || bestDistance == null}
          aria-label="Share result"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-[var(--foreground)] transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sharing ? (
            <Loader2 size={13} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
          ) : (
            <Share2 size={13} strokeWidth={1.75} aria-hidden="true" />
          )}
          Share
        </button>
      </div>

      {/* Meet name */}
      <h2 className="font-heading text-2xl sm:text-[28px] text-[var(--foreground)] mt-2 leading-tight">
        {meetName}
      </h2>

      {/* Best throw — the big read */}
      <div className="mt-5 flex items-end gap-3 flex-wrap">
        <div className="flex items-end gap-2">
          {isPersonalBest && bestDistance != null && (
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-500/20 text-primary-500 mb-2"
              aria-label="Personal best"
              title="Personal best"
            >
              <Trophy size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
          )}
          <span className="font-heading text-6xl sm:text-7xl font-semibold tabular-nums leading-none text-[var(--foreground)] tracking-tight">
            {formatDistance(bestDistance)}
          </span>
          <span className="font-mono text-base text-muted uppercase tracking-wider mb-2">m</span>
        </div>

        {/* Delta vs season-best */}
        {delta != null && (
          <div className="ml-auto pb-2">
            <div
              className={
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-mono tabular-nums " +
                (deltaState === "up"
                  ? "bg-success-500/15 text-success-600 dark:text-success-400"
                  : deltaState === "down"
                    ? "bg-danger-500/10 text-danger-600 dark:text-danger-400"
                    : "bg-surface-100 dark:bg-surface-800 text-muted")
              }
              aria-label={`${formatDelta(delta)} vs season best`}
            >
              {deltaState === "up" ? (
                <ArrowUp size={12} strokeWidth={2} aria-hidden="true" />
              ) : deltaState === "down" ? (
                <ArrowDown size={12} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Minus size={12} strokeWidth={2} aria-hidden="true" />
              )}
              {formatDelta(delta)}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted mt-1 text-right">
              vs season best{" "}
              <span className="font-mono text-[var(--foreground)]/80">
                {formatDistance(seasonBestDistance)}m
              </span>
            </p>
          </div>
        )}
        {delta == null && seasonBestDistance == null && bestDistance != null && (
          <p className="ml-auto pb-2 text-[10px] uppercase tracking-wider text-muted">
            First mark this season
          </p>
        )}
      </div>

      {bestDistance == null && (
        <p className="mt-4 text-sm text-muted">
          No mark recorded yet. Add throws below — the hero refreshes as you log.
        </p>
      )}
    </div>
  );
}

/* ─── Canvas-rendered share card ─────────────────────────────────────────
   Hand-drawn 1080×1080 PNG. Pure Canvas API — no html-to-image / dom-to-png
   dep, which keeps the bundle lean and dodges the SVG-foreignObject quirks
   those libraries have on iOS Safari.
   ─────────────────────────────────────────────────────────────────── */

interface ShareCardInput {
  meetName: string;
  formattedDate: string;
  eventLabel: string;
  bestDistance: number;
  delta: number | null;
  athleteName: string;
  isPersonalBest: boolean;
  placeFinish: number | null;
}

async function renderShareCardPng(input: ShareCardInput): Promise<string> {
  const SIZE = 1080;
  const PADDING = 64;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Background — radial spotlight on near-black, brand-true to the app's
  // marketing surface where shared cards will be seen alongside.
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE * 0.35, 100, SIZE / 2, SIZE / 2, SIZE);
  bg.addColorStop(0, "#1a1a20");
  bg.addColorStop(1, "#08080a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Top eyebrow line: event · date · place
  ctx.fillStyle = "#a3a3a8";
  ctx.font = "600 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textBaseline = "top";
  const eyebrow =
    `${input.eventLabel.toUpperCase()}  ·  ${input.formattedDate.toUpperCase()}` +
    (input.placeFinish != null
      ? `  ·  ${input.placeFinish}${ORDINAL_SUFFIX(input.placeFinish)} PLACE`
      : "");
  ctx.fillText(eyebrow, PADDING, PADDING);

  // Meet name — heading
  ctx.fillStyle = "#f4f4f5";
  ctx.font = "600 56px 'Chakra Petch', ui-sans-serif, system-ui, sans-serif";
  wrapText(ctx, input.meetName, PADDING, PADDING + 64, SIZE - PADDING * 2, 64);

  // PB ribbon (if applicable)
  if (input.isPersonalBest) {
    ctx.fillStyle = "#FFC800";
    ctx.font = "700 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("★ PERSONAL BEST", PADDING, PADDING + 192);
  }

  // Big distance
  const distanceText = parseFloat(input.bestDistance.toFixed(2)).toString();
  ctx.fillStyle = "#f4f4f5";
  ctx.font = "600 280px 'Chakra Petch', ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  // Center the distance + meter unit horizontally as a group.
  const distWidth = ctx.measureText(distanceText).width;
  ctx.font = "500 80px ui-monospace, SFMono-Regular, Menlo, monospace";
  const mWidth = ctx.measureText("m").width;
  const totalGroup = distWidth + 24 + mWidth;
  const groupStart = (SIZE - totalGroup) / 2;
  ctx.font = "600 280px 'Chakra Petch', ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(distanceText, groupStart, SIZE * 0.62);
  ctx.font = "500 80px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "#a3a3a8";
  ctx.fillText("m", groupStart + distWidth + 24, SIZE * 0.62 - 12);

  // Delta chip
  if (input.delta != null) {
    const chipText =
      (input.delta > 0 ? "+" : input.delta < 0 ? "−" : "") +
      Math.abs(input.delta).toFixed(2) +
      "m  vs season best";
    ctx.font = "600 28px ui-monospace, SFMono-Regular, Menlo, monospace";
    const chipW = ctx.measureText(chipText).width + 48;
    const chipH = 56;
    const chipX = (SIZE - chipW) / 2;
    const chipY = SIZE * 0.66;
    ctx.fillStyle =
      input.delta > 0.005
        ? "rgba(0, 255, 136, 0.14)"
        : input.delta < -0.005
          ? "rgba(255, 34, 34, 0.12)"
          : "rgba(255, 255, 255, 0.06)";
    roundRect(ctx, chipX, chipY, chipW, chipH, 28);
    ctx.fill();
    ctx.fillStyle = input.delta > 0.005 ? "#00FF88" : input.delta < -0.005 ? "#ff7777" : "#a3a3a8";
    ctx.textBaseline = "middle";
    ctx.fillText(chipText, chipX + 24, chipY + chipH / 2);
  }

  // Footer — athlete name + brand
  ctx.fillStyle = "#a3a3a8";
  ctx.font = "500 26px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(input.athleteName, PADDING, SIZE - PADDING - 12);

  ctx.fillStyle = "#FFC800";
  ctx.font = "700 26px 'Chakra Petch', ui-sans-serif, system-ui, sans-serif";
  const brand = "PODIUM THROWS";
  const brandW = ctx.measureText(brand).width;
  ctx.fillText(brand, SIZE - PADDING - brandW, SIZE - PADDING - 12);

  return canvas.toDataURL("image/png");
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = w;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
