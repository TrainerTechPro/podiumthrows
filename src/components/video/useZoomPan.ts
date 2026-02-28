"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type ZoomPanState = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type UseZoomPanOptions = {
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  wheelSensitivity?: number;
  enabled?: boolean;
  /** When true, single-finger/mouse = draw, not pan */
  isDrawingActive?: boolean;
  /** External state to follow (follower mode — mirrors another instance) */
  linkedState?: ZoomPanState;
  /** Fires on every transform change (leader mode — broadcasts to followers) */
  onTransformChange?: (state: ZoomPanState) => void;
};

export type UseZoomPanReturn = {
  state: ZoomPanState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isZoomed: boolean;
  isTransitioning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  zoomTo: (scale: number, centerX?: number, centerY?: number) => void;
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const DEFAULT_MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 5;
const DEFAULT_DOUBLE_TAP_SCALE = 2.5;
const DEFAULT_WHEEL_SENSITIVITY = 0.002;
const DOUBLE_TAP_THRESHOLD_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const ZOOM_STEP = 0.5;
const TRANSITION_DURATION_MS = 300;

/* ─── Hook ────────────────────────────────────────────────────────────────── */

export function useZoomPan(options: UseZoomPanOptions = {}): UseZoomPanReturn {
  const {
    minScale = DEFAULT_MIN_SCALE,
    maxScale = DEFAULT_MAX_SCALE,
    doubleTapScale = DEFAULT_DOUBLE_TAP_SCALE,
    wheelSensitivity = DEFAULT_WHEEL_SENSITIVITY,
    enabled = true,
    isDrawingActive = false,
    linkedState,
    onTransformChange,
  } = options;

  /* ── State ───────────────────────────────────────────────────────── */

  const [state, _setStateRaw] = useState<ZoomPanState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  /** Tracks whether the current state change originated locally (prevents follower feedback loops) */
  const isLocalChangeRef = useRef(false);
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;

  /** Wrapped setState that broadcasts to followers when change is local */
  const setState = useCallback((next: ZoomPanState | ((prev: ZoomPanState) => ZoomPanState)) => {
    _setStateRaw((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      // Only broadcast if this is a local (user-initiated) change
      if (onTransformChangeRef.current) {
        // Schedule broadcast after state update to avoid re-entry
        queueMicrotask(() => onTransformChangeRef.current?.(resolved));
      }
      return resolved;
    });
  }, []);

  /* ── Refs for gesture tracking ──────────────────────────────────── */

  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });

  // Pinch gesture refs
  const isPinching = useRef(false);
  const initialPinchDistance = useRef(0);
  const initialPinchScale = useRef(1);
  const initialPinchMidpoint = useRef({ x: 0, y: 0 });
  const initialPinchTranslate = useRef({ x: 0, y: 0 });

  // RAF batching for wheel events
  const pendingWheelDelta = useRef(0);
  const pendingWheelCenter = useRef({ x: 0, y: 0 });
  const wheelRaf = useRef(0);

  // Keep a ref copy of state for event handlers
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ── Clamping ───────────────────────────────────────────────────── */

  const clampTranslate = useCallback(
    (tx: number, ty: number, scale: number): { tx: number; ty: number } => {
      if (scale <= 1) return { tx: 0, ty: 0 };
      const el = containerRef.current;
      if (!el) return { tx, ty };
      const w = el.clientWidth;
      const h = el.clientHeight;
      const minTx = w * (1 - scale);
      const minTy = h * (1 - scale);
      return {
        tx: Math.max(minTx, Math.min(0, tx)),
        ty: Math.max(minTy, Math.min(0, ty)),
      };
    },
    []
  );

  const clampScale = useCallback(
    (s: number) => Math.max(minScale, Math.min(maxScale, s)),
    [minScale, maxScale]
  );

  /* ── Zoom-around-point helper ───────────────────────────────────── */

  const zoomAroundPoint = useCallback(
    (newScale: number, centerX: number, centerY: number) => {
      const s = stateRef.current;
      const clamped = clampScale(newScale);
      const ratio = clamped / s.scale;
      const newTx = centerX - ratio * (centerX - s.translateX);
      const newTy = centerY - ratio * (centerY - s.translateY);
      const { tx, ty } = clampTranslate(newTx, newTy, clamped);
      setState({ scale: clamped, translateX: tx, translateY: ty });
    },
    [clampScale, clampTranslate, setState]
  );

  /* ── Animated transition helper ──────────────────────────────────── */

  const animateToState = useCallback(
    (target: ZoomPanState) => {
      setIsTransitioning(true);
      setState(target);
      setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION_MS);
    },
    [setState]
  );

  /* ── Programmatic controls ──────────────────────────────────────── */

  const zoomIn = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const centerX = el.clientWidth / 2;
    const centerY = el.clientHeight / 2;
    const newScale = clampScale(stateRef.current.scale + ZOOM_STEP);
    setIsTransitioning(true);
    zoomAroundPoint(newScale, centerX, centerY);
    setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION_MS);
  }, [clampScale, zoomAroundPoint]);

  const zoomOut = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const centerX = el.clientWidth / 2;
    const centerY = el.clientHeight / 2;
    const newScale = clampScale(stateRef.current.scale - ZOOM_STEP);
    if (newScale <= 1) {
      animateToState({ scale: 1, translateX: 0, translateY: 0 });
    } else {
      setIsTransitioning(true);
      zoomAroundPoint(newScale, centerX, centerY);
      setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION_MS);
    }
  }, [clampScale, zoomAroundPoint, animateToState]);

  const resetZoom = useCallback(() => {
    animateToState({ scale: 1, translateX: 0, translateY: 0 });
  }, [animateToState]);

  const zoomTo = useCallback(
    (scale: number, centerX?: number, centerY?: number) => {
      const el = containerRef.current;
      if (!el) return;
      const cx = centerX ?? el.clientWidth / 2;
      const cy = centerY ?? el.clientHeight / 2;
      setIsTransitioning(true);
      zoomAroundPoint(clampScale(scale), cx, cy);
      setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION_MS);
    },
    [clampScale, zoomAroundPoint]
  );

  /* ── Wheel zoom (native listener for passive:false) ─────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    function processWheel() {
      const delta = pendingWheelDelta.current;
      const center = pendingWheelCenter.current;
      pendingWheelDelta.current = 0;
      wheelRaf.current = 0;

      const s = stateRef.current;
      const newScale = clampScale(s.scale * (1 - delta * wheelSensitivity));
      if (newScale <= 1 && s.scale <= 1) return; // Already at min, skip
      zoomAroundPoint(newScale, center.x, center.y);
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault();

      const rect = el!.getBoundingClientRect();
      pendingWheelDelta.current += e.deltaY;
      pendingWheelCenter.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (!wheelRaf.current) {
        wheelRaf.current = requestAnimationFrame(processWheel);
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (wheelRaf.current) cancelAnimationFrame(wheelRaf.current);
    };
  }, [enabled, wheelSensitivity, clampScale, zoomAroundPoint]);

  /* ── Touch gestures (pinch + pan + double-tap) ──────────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    function getTouchDistance(t1: Touch, t2: Touch): number {
      return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }

    function getTouchMidpoint(t1: Touch, t2: Touch, rect: DOMRect) {
      return {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length >= 2) {
        // ── Pinch start ──
        isPinching.current = true;
        isPanning.current = false;
        const rect = el!.getBoundingClientRect();
        initialPinchDistance.current = getTouchDistance(e.touches[0], e.touches[1]);
        initialPinchScale.current = stateRef.current.scale;
        initialPinchMidpoint.current = getTouchMidpoint(e.touches[0], e.touches[1], rect);
        initialPinchTranslate.current = {
          x: stateRef.current.translateX,
          y: stateRef.current.translateY,
        };
        e.preventDefault();
        return;
      }

      if (e.touches.length === 1) {
        const s = stateRef.current;
        const touch = e.touches[0];

        // ── Double-tap detection ──
        const now = Date.now();
        const dt = now - lastTapTime.current;
        const dist = Math.hypot(
          touch.clientX - lastTapPos.current.x,
          touch.clientY - lastTapPos.current.y
        );

        if (dt < DOUBLE_TAP_THRESHOLD_MS && dist < DOUBLE_TAP_DISTANCE_PX) {
          // Double tap detected
          e.preventDefault();
          lastTapTime.current = 0;
          const rect = el!.getBoundingClientRect();
          const cx = touch.clientX - rect.left;
          const cy = touch.clientY - rect.top;

          if (s.scale > 1) {
            animateToState({ scale: 1, translateX: 0, translateY: 0 });
          } else {
            setIsTransitioning(true);
            zoomAroundPoint(doubleTapScale, cx, cy);
            setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION_MS);
          }
          return;
        }

        lastTapTime.current = now;
        lastTapPos.current = { x: touch.clientX, y: touch.clientY };

        // ── Pan start (only when zoomed and not drawing) ──
        if (s.scale > 1 && !isDrawingActive) {
          isPanning.current = true;
          lastPanPos.current = { x: touch.clientX, y: touch.clientY };
          e.preventDefault();
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (isPinching.current && e.touches.length >= 2) {
        e.preventDefault();
        const rect = el!.getBoundingClientRect();
        const newDist = getTouchDistance(e.touches[0], e.touches[1]);
        const ratio = newDist / initialPinchDistance.current;
        const newScale = clampScale(initialPinchScale.current * ratio);

        // Zoom around pinch midpoint
        const mid = initialPinchMidpoint.current;
        const scaleRatio = newScale / initialPinchScale.current;
        const newTx = mid.x - scaleRatio * (mid.x - initialPinchTranslate.current.x);
        const newTy = mid.y - scaleRatio * (mid.y - initialPinchTranslate.current.y);

        // Also allow pan during pinch (midpoint movement)
        const currentMid = getTouchMidpoint(e.touches[0], e.touches[1], rect);
        const panDx = currentMid.x - mid.x;
        const panDy = currentMid.y - mid.y;

        const { tx, ty } = clampTranslate(newTx + panDx, newTy + panDy, newScale);
        setState({ scale: newScale, translateX: tx, translateY: ty });
        return;
      }

      if (isPanning.current && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - lastPanPos.current.x;
        const dy = touch.clientY - lastPanPos.current.y;
        lastPanPos.current = { x: touch.clientX, y: touch.clientY };

        setState((prev) => {
          const { tx, ty } = clampTranslate(
            prev.translateX + dx,
            prev.translateY + dy,
            prev.scale
          );
          return { ...prev, translateX: tx, translateY: ty };
        });
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) isPinching.current = false;
      if (e.touches.length === 0) {
        isPanning.current = false;
        // Snap to 1x if scale is very close
        const s = stateRef.current;
        if (s.scale < 1.05 && s.scale > 0.95) {
          animateToState({ scale: 1, translateX: 0, translateY: 0 });
        }
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    enabled,
    isDrawingActive,
    doubleTapScale,
    clampScale,
    clampTranslate,
    zoomAroundPoint,
    animateToState,
    setState,
  ]);

  /* ── Mouse pan (desktop: click + drag when zoomed) ──────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    function handleMouseDown(e: MouseEvent) {
      const s = stateRef.current;
      // Only pan when zoomed and not drawing
      if (s.scale <= 1 || isDrawingActive) return;
      // Left button only
      if (e.button !== 0) return;

      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      el!.style.cursor = "grabbing";
      e.preventDefault();
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isPanning.current) return;
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };

      setState((prev) => {
        const { tx, ty } = clampTranslate(
          prev.translateX + dx,
          prev.translateY + dy,
          prev.scale
        );
        return { ...prev, translateX: tx, translateY: ty };
      });
    }

    function handleMouseUp() {
      if (isPanning.current) {
        isPanning.current = false;
        if (el) el.style.cursor = "";
      }
    }

    el.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, isDrawingActive, clampTranslate, setState]);

  /* ── Follower: apply linkedState from leader ────────────────────── */

  useEffect(() => {
    if (!linkedState) return;
    // Skip if this is a local change echoing back
    if (isLocalChangeRef.current) {
      isLocalChangeRef.current = false;
      return;
    }
    // Apply leader's state directly (no broadcast back)
    _setStateRaw(linkedState);
  }, [linkedState]);

  /* ── Derived ────────────────────────────────────────────────────── */

  const isZoomed = state.scale > 1.01;

  return {
    state,
    containerRef,
    isZoomed,
    isTransitioning,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomTo,
  };
}
