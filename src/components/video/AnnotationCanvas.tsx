"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  type Annotation,
  type AnnotationTool,
  type Point,
  isAnnotationVisible,
  generateAnnotationId,
  DEFAULT_ANNOTATION_DURATION,
} from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  annotations: Annotation[];
  currentTime: number;
  isEditing?: boolean;
  activeTool?: AnnotationTool;
  activeColor?: string;
  activeStrokeWidth?: number;
  onAnnotationAdd?: (annotation: Annotation) => void;
  className?: string;
};

/* ─── Drawing State ───────────────────────────────────────────────────────── */

type DrawState =
  | { phase: "idle" }
  | { phase: "drawing"; points: Point[] }
  | { phase: "text-input"; position: Point };

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AnnotationCanvas({
  annotations,
  currentTime,
  isEditing = false,
  activeTool = "select",
  activeColor = "#ef4444",
  activeStrokeWidth = 4,
  onAnnotationAdd,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawState, setDrawState] = useState<DrawState>({ phase: "idle" });
  const [textValue, setTextValue] = useState("");
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  /* ── Resize observer ─────────────────────────────────────────────────── */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /* ── Sync canvas dimensions ──────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
  }, [canvasSize]);

  /* ── Normalized point helpers ────────────────────────────────────────── */

  const getPoint = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const getPointFromTouch = useCallback(
    (e: ReactTouchEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  /* ── Shared drawing logic ──────────────────────────────────────────── */

  const startDraw = useCallback(
    (pt: Point) => {
      if (!isEditing || activeTool === "select") return;

      if (activeTool === "text") {
        setTextPos(pt);
        setTextValue("");
        setDrawState({ phase: "text-input", position: pt });
        return;
      }

      setDrawState({ phase: "drawing", points: [pt] });
    },
    [isEditing, activeTool]
  );

  const continueDraw = useCallback(
    (pt: Point) => {
      if (drawState.phase !== "drawing") return;

      if (activeTool === "freehand") {
        setDrawState((prev) =>
          prev.phase === "drawing"
            ? { ...prev, points: [...prev.points, pt] }
            : prev
        );
      } else {
        setDrawState((prev) =>
          prev.phase === "drawing"
            ? { ...prev, points: [prev.points[0], pt] }
            : prev
        );
      }
    },
    [drawState.phase, activeTool]
  );

  const finishDraw = useCallback(
    (pt: Point) => {
      if (drawState.phase !== "drawing") return;

      let finalPoints = [...drawState.points];

      if (activeTool === "freehand") {
        finalPoints.push(pt);
      } else if (activeTool === "angle") {
        if (finalPoints.length < 3) {
          setDrawState({ phase: "drawing", points: [...finalPoints, pt] });
          return;
        }
      } else {
        finalPoints = [finalPoints[0], pt];
      }

      // Skip if points are too close (accidental click/tap)
      if (
        activeTool !== "freehand" &&
        finalPoints.length === 2 &&
        Math.abs(finalPoints[0].x - finalPoints[1].x) < 0.005 &&
        Math.abs(finalPoints[0].y - finalPoints[1].y) < 0.005
      ) {
        setDrawState({ phase: "idle" });
        return;
      }

      const annotation: Annotation = {
        id: generateAnnotationId(),
        timestamp: currentTime,
        duration: DEFAULT_ANNOTATION_DURATION,
        type: activeTool as Annotation["type"],
        points: finalPoints,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      };

      onAnnotationAdd?.(annotation);
      setDrawState({ phase: "idle" });
    },
    [drawState, activeTool, currentTime, activeColor, activeStrokeWidth, onAnnotationAdd]
  );

  /* ── Mouse handlers ──────────────────────────────────────────────────── */

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      startDraw(getPoint(e));
    },
    [getPoint, startDraw]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (drawState.phase !== "drawing") return;
      e.preventDefault();
      continueDraw(getPoint(e));
    },
    [drawState.phase, getPoint, continueDraw]
  );

  const handleMouseUp = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (drawState.phase !== "drawing") return;
      e.preventDefault();
      finishDraw(getPoint(e));
    },
    [drawState.phase, getPoint, finishDraw]
  );

  /* ── Touch handlers (with multi-touch guard for pinch-to-zoom) ────── */

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLCanvasElement>) => {
      // Multi-touch guard: 2+ fingers = pinch/zoom, not drawing
      if (e.touches.length > 1) {
        // Cancel any in-progress drawing — user is pinching
        if (drawState.phase === "drawing") {
          setDrawState({ phase: "idle" });
        }
        return; // Let ZoomableVideoContainer handle the pinch
      }
      if (!isEditing || activeTool === "select") return;
      e.preventDefault();
      startDraw(getPointFromTouch(e));
    },
    [isEditing, activeTool, drawState.phase, getPointFromTouch, startDraw]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLCanvasElement>) => {
      // Multi-touch guard: if a second finger joins, cancel drawing
      if (e.touches.length > 1) {
        if (drawState.phase === "drawing") {
          setDrawState({ phase: "idle" });
        }
        return;
      }
      if (drawState.phase !== "drawing") return;
      e.preventDefault();
      continueDraw(getPointFromTouch(e));
    },
    [drawState.phase, getPointFromTouch, continueDraw]
  );

  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLCanvasElement>) => {
      if (drawState.phase !== "drawing") return;
      // Only finish if this is the last finger leaving
      if (e.touches.length > 0) return;
      e.preventDefault();
      finishDraw(getPointFromTouch(e));
    },
    [drawState.phase, getPointFromTouch, finishDraw]
  );

  /* ── Text commit ─────────────────────────────────────────────────────── */

  const commitText = useCallback(() => {
    if (!textValue.trim() || !textPos) {
      setDrawState({ phase: "idle" });
      setTextPos(null);
      return;
    }

    const annotation: Annotation = {
      id: generateAnnotationId(),
      timestamp: currentTime,
      duration: DEFAULT_ANNOTATION_DURATION,
      type: "text",
      points: [textPos],
      color: activeColor,
      strokeWidth: activeStrokeWidth,
      text: textValue.trim(),
      fontSize: 16,
    };

    onAnnotationAdd?.(annotation);
    setDrawState({ phase: "idle" });
    setTextPos(null);
    setTextValue("");
  }, [
    textValue,
    textPos,
    currentTime,
    activeColor,
    activeStrokeWidth,
    onAnnotationAdd,
  ]);

  /* ── Render canvas ───────────────────────────────────────────────────── */

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw saved annotations visible at current time
    const visible = annotations.filter((a) =>
      isAnnotationVisible(a, currentTime)
    );
    for (const ann of visible) {
      drawAnnotation(ctx, ann, w, h);
    }

    // Draw in-progress drawing
    if (drawState.phase === "drawing" && drawState.points.length > 0) {
      const preview: Annotation = {
        id: "preview",
        timestamp: currentTime,
        duration: DEFAULT_ANNOTATION_DURATION,
        type: activeTool as Annotation["type"],
        points: drawState.points,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
      };
      drawAnnotation(ctx, preview, w, h);
    }
  }, [
    annotations,
    currentTime,
    drawState,
    activeTool,
    activeColor,
    activeStrokeWidth,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className ?? ""}`}
      style={{ pointerEvents: isEditing ? "auto" : "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          cursor: isEditing && activeTool !== "select" ? "crosshair" : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (drawState.phase === "drawing") {
            setDrawState({ phase: "idle" });
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Text input overlay */}
      {drawState.phase === "text-input" && textPos && (
        <div
          className="absolute z-10"
          style={{
            left: `${textPos.x * 100}%`,
            top: `${textPos.y * 100}%`,
            transform: "translate(-4px, -4px)",
          }}
        >
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") {
                setDrawState({ phase: "idle" });
                setTextPos(null);
              }
            }}
            onBlur={commitText}
            autoFocus
            className="bg-black/70 text-white text-sm px-2 py-1 rounded border border-white/30 outline-none min-w-[120px]"
            placeholder="Type annotation..."
          />
        </div>
      )}
    </div>
  );
}

/* ─── Draw Helpers ─────────────────────────────────────────────────────────── */

function toCanvas(pt: Point, w: number, h: number): [number, number] {
  return [pt.x * w, pt.y * h];
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  w: number,
  h: number
) {
  ctx.save();
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = ann.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const pts = ann.points.map((p) => toCanvas(p, w, h));

  switch (ann.type) {
    case "line":
      drawLine(ctx, pts);
      break;
    case "arrow":
      drawArrow(ctx, pts);
      break;
    case "circle":
      drawCircle(ctx, pts);
      break;
    case "angle":
      drawAngle(ctx, pts, ann);
      break;
    case "freehand":
      drawFreehand(ctx, pts);
      break;
    case "text":
      drawText(ctx, pts, ann);
      break;
  }

  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[1];

  // Line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(12, ctx.lineWidth * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return;
  const [cx, cy] = pts[0];
  const [ex, ey] = pts[1];
  const radius = Math.hypot(ex - cx, ey - cy);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAngle(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  ann: Annotation
) {
  if (pts.length < 3) {
    // Draw partial (lines from first points)
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.stroke();
    }
    return;
  }

  const [vx, vy] = pts[0]; // vertex
  const [ax, ay] = pts[1]; // arm 1
  const [bx, by] = pts[2]; // arm 2

  // Draw arms
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(vx, vy);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Calculate angle
  const angle1 = Math.atan2(ay - vy, ax - vx);
  const angle2 = Math.atan2(by - vy, bx - vx);
  let degrees = ((angle2 - angle1) * 180) / Math.PI;
  if (degrees < 0) degrees += 360;
  if (degrees > 180) degrees = 360 - degrees;

  // Draw arc
  const arcRadius = Math.min(30, Math.hypot(ax - vx, ay - vy) * 0.3);
  ctx.beginPath();
  ctx.arc(vx, vy, arcRadius, Math.min(angle1, angle2), Math.max(angle1, angle2));
  ctx.stroke();

  // Label
  const midAngle = (angle1 + angle2) / 2;
  const labelX = vx + (arcRadius + 14) * Math.cos(midAngle);
  const labelY = vy + (arcRadius + 14) * Math.sin(midAngle);
  ctx.font = `bold 12px sans-serif`;
  ctx.fillStyle = ann.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(degrees)}°`, labelX, labelY);
}

function drawFreehand(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  ann: Annotation
) {
  if (!ann.text || pts.length < 1) return;
  const [x, y] = pts[0];
  const fontSize = ann.fontSize ?? 16;

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Background
  const metrics = ctx.measureText(ann.text);
  const pad = 4;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(
    x - pad,
    y - pad,
    metrics.width + pad * 2,
    fontSize + pad * 2
  );

  // Text
  ctx.fillStyle = ann.color;
  ctx.fillText(ann.text, x, y);
}
