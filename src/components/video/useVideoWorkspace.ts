"use client";

import { createContext, useContext } from "react";
import type { RefObject } from "react";
import type { ZoomPanState, UseZoomPanReturn } from "./useZoomPan";
import type { useFrameExtractor } from "./useFrameExtractor";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type VideoSource = {
  src: string;
  poster?: string;
  title?: string;
  /** GOP-15 transcoded MP4 — preferred for frame extraction (faster seeking) */
  transcodedUrl?: string;
};

/** Return type of `useFrameExtractor` — surfaced so consumers can read extraction state */
export type FrameExtractorState = ReturnType<typeof useFrameExtractor>;

export interface VideoWorkspaceState {
  /* ── Playback State ────────────────────────────────────────────────── */

  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  mode: "single" | "split" | "ghost";
  ghostOpacity: number;

  /* ── Frame-Perfect Mode ────────────────────────────────────────────── */

  framePerfectMode: boolean;
  framePerfectActive: boolean;
  currentFrameIndex: number;
  frameExtractor: FrameExtractorState;

  /* ── Sync & Linking (split/ghost) ──────────────────────────────────── */

  syncLock: boolean;
  syncOffset: number;
  spatialLock: boolean;
  linked: boolean;
  activePanel: "A" | "B";
  bCurrentTime: number;
  bDuration: number;

  /* ── Zoom/Pan ──────────────────────────────────────────────────────── */

  zoomPanA: UseZoomPanReturn;
  zoomPanB: UseZoomPanReturn;
  leaderZoomState: ZoomPanState;

  /* ── Playback Actions ──────────────────────────────────────────────── */

  seekTo: (time: number) => void;
  seekB: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  reSync: () => void;

  /* ── Toggle Actions ────────────────────────────────────────────────── */

  toggleSyncLock: () => void;
  toggleSpatialLock: () => void;
  toggleLinked: () => void;
  toggleFramePerfect: () => void;
  setActivePanel: (panel: "A" | "B") => void;
  setGhostOpacity: (v: number) => void;
  handleFrameChange: (index: number) => void;

  /* ── Speed Menu (UI state) ─────────────────────────────────────────── */

  showSpeedMenu: boolean;
  setShowSpeedMenu: (v: boolean) => void;

  /* ── Refs ───────────────────────────────────────────────────────────── */

  videoARef: RefObject<HTMLVideoElement | null>;
  videoBRef: RefObject<HTMLVideoElement | null>;

  /* ── Computed ───────────────────────────────────────────────────────── */

  progress: number;
  hasVideoB: boolean;
  jogWheelTargetsB: boolean;

  /* ── Video Event Handlers (for attaching to <video> elements) ─────── */

  handleLoadedMetadata: () => void;
  handleLoadedMetadataB: () => void;
  handleVideoBTimeUpdate: () => void;
  handleVideoAPlay: () => void;
  handleVideoAPause: () => void;

  /* ── Constants ──────────────────────────────────────────────────────── */

  speedOptions: number[];
}

/* ─── Context ─────────────────────────────────────────────────────────────── */

export const VideoWorkspaceContext =
  createContext<VideoWorkspaceState | null>(null);

/* ─── Hook ────────────────────────────────────────────────────────────────── */

export function useVideoWorkspace(): VideoWorkspaceState {
  const ctx = useContext(VideoWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useVideoWorkspace must be used within a <VideoWorkspaceProvider>"
    );
  }
  return ctx;
}
