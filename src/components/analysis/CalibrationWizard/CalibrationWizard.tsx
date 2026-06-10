"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Camera, Check, CircleAlert, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { AnalysisEvent, RingEllipse } from "@/lib/contracts";
import {
  EVENT_CAPTURE_CONFIG,
  LOCK_HOLD_MS,
  initialWizardState,
  wizardReducer,
} from "./wizard-machine";
import { useDeviceOrientation } from "./useDeviceOrientation";
import { GhostEllipse } from "./GhostEllipse";
import { SpeechCues, cueForAlignment } from "./SpeechCues";

/**
 * F1 Capture & Calibration Wizard. State lives in the pure reducer
 * (wizard-machine.ts); this layer owns only browser plumbing: camera
 * preview, gyro permission, speech cues, lock-hold timer, save call.
 */

const EVENTS: Array<{ id: AnalysisEvent; label: string }> = [
  { id: "SHOT_PUT", label: "Shot put" },
  { id: "DISCUS", label: "Discus" },
  { id: "HAMMER", label: "Hammer" },
];

/** Ghost template in normalized preview coords (lower third of frame). */
const GHOST_NORM = { cx: 50, cy: 72, rx: 34, ry: 13 };

const ZONE_BORDER: Record<string, string> = {
  MISALIGNED: "border-status-danger-fg",
  CLOSE: "border-status-warning-fg",
  LOCKED: "border-status-success-fg",
};

export function CalibrationWizard({
  athleteId,
  onDone,
}: {
  athleteId?: string | null;
  onDone?: (calibrationSessionId: string) => void;
}) {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cuesRef = useRef<SpeechCues>(new SpeechCues());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const toast = useToast();

  const config = state.event ? EVENT_CAPTURE_CONFIG[state.event] : null;

  const { requestPermission } = useDeviceOrientation({
    active: state.step === "align",
    onStatus: (status) =>
      dispatch(
        status === "granted"
          ? { type: "GYRO_GRANTED" }
          : status === "denied"
            ? { type: "GYRO_DENIED" }
            : { type: "GYRO_UNSUPPORTED" }
      ),
    onSample: (sample) =>
      dispatch({ type: "ORIENTATION_SAMPLE", sample, nowMs: Date.now() }),
  });

  // Camera preview while aligning.
  useEffect(() => {
    if (state.step !== "align") return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        setCameraError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission denied — allow camera access to align the ring."
            : "Camera unavailable — you can still align by eye."
        );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [state.step]);

  // Lock-hold timer → capture.
  useEffect(() => {
    if (state.step !== "align" || state.alignment !== "LOCKED") return;
    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      const vw = video?.videoWidth || 1920;
      const vh = video?.videoHeight || 1080;
      const ringEllipse: RingEllipse = {
        cx: (GHOST_NORM.cx / 100) * vw,
        cy: (GHOST_NORM.cy / 100) * vh,
        rx: (GHOST_NORM.rx / 100) * vw,
        ry: (GHOST_NORM.ry / 100) * vh,
        rotation: 0,
      };
      dispatch({ type: "LOCK_HOLD_ELAPSED", nowMs: Date.now(), ringEllipse });
      cuesRef.current.speak("Captured.", { force: true });
    }, LOCK_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [state.step, state.alignment, state.lockedSinceMs]);

  // Speech cues on alignment changes (gyro path only — manual path is silent).
  useEffect(() => {
    if (state.step !== "align" || state.gyro !== "granted" || !config) return;
    const sample = state.lastSample;
    cuesRef.current.speak(
      cueForAlignment({
        zone: state.alignment,
        rollDeg: sample?.gamma ?? null,
        pitchDownDeg: sample?.beta != null ? 90 - sample.beta : null,
        pitchBand: config.pitchBand,
      })
    );
  }, [state.step, state.gyro, state.alignment, state.lastSample, config]);

  useEffect(() => () => cuesRef.current.stop(), []);

  const save = useCallback(async () => {
    if (!state.event || !state.ringEllipse) return;
    dispatch({ type: "SAVE" });
    try {
      const res = await fetch("/api/analysis/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: state.event,
          ringEllipse: state.ringEllipse,
          deviceOrientation: state.lastSample,
          athleteId: athleteId ?? null,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        dispatch({
          type: "SAVE_FAILED",
          message: payload.error || `Request failed (${res.status})`,
        });
        toast.error(payload.error || "Could not save calibration — try again.");
        return;
      }
      dispatch({ type: "SAVE_OK", calibrationSessionId: payload.data.id });
      if (!payload.data.calibrated) {
        toast.warning(
          "Saved, but the ring shape couldn't calibrate distances. Angles and timing still work."
        );
      } else {
        toast.success("Calibration saved");
      }
      onDone?.(payload.data.id);
    } catch {
      dispatch({ type: "SAVE_FAILED", message: "Network error — please try again" });
      toast.error("Network error — please try again");
    }
  }, [state.event, state.ringEllipse, state.lastSample, athleteId, onDone, toast]);

  return (
    <div className="card max-w-xl space-y-4 p-5" data-testid="calibration-wizard">
      {state.step === "event_select" && (
        <section className="space-y-3">
          <h2 className="font-heading text-section">Set up your camera</h2>
          <p className="text-body text-muted">
            Pick the event — the wizard positions your tripod and calibrates
            distances from the ring.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {EVENTS.map((e) => (
              <button
                key={e.id}
                type="button"
                className="btn-secondary py-3"
                onClick={() => dispatch({ type: "SELECT_EVENT", event: e.id })}
              >
                {e.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {state.step === "position" && config && (
        <section className="space-y-3" data-testid="position-step">
          <h2 className="font-heading text-section">Tripod position</h2>
          <ul className="space-y-1 text-body">
            <li>• {config.positionLabel}</li>
            <li>
              • At least <span className="font-mono tabular-nums">{config.minTripodDistanceM} m</span> from
              the circle — closer breaks distance calibration
            </li>
            <li>• Chest height, pointed slightly down at the ring</li>
          </ul>
          <button type="button" className="btn-primary w-full" onClick={() => dispatch({ type: "CONFIRM_POSITION" })}>
            Tripod is placed
          </button>
        </section>
      )}

      {state.step === "align" && config && (
        <section className="space-y-3" data-testid="align-step">
          <div
            className={`relative aspect-video w-full overflow-hidden rounded-lg border-4 bg-surface-950 transition-colors duration-300 ${ZONE_BORDER[state.alignment]}`}
            data-testid="align-viewport"
            data-zone={state.alignment}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <GhostEllipse zone={state.alignment} ellipseNorm={GHOST_NORM} />
            {cameraError && (
              <p className="absolute inset-x-3 top-3 rounded bg-[var(--surface-overlay)] p-2 text-caption">
                <CircleAlert className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {cameraError}
              </p>
            )}
          </div>
          <p className="text-caption text-muted">
            Move the tripod until the real ring fills the ghost ellipse.
          </p>
          {state.gyro === "unknown" && (
            <button type="button" className="btn-primary w-full" onClick={requestPermission}>
              Enable level assist
            </button>
          )}
          {(state.gyro === "denied" || state.gyro === "unsupported") && (
            <button
              type="button"
              className="btn-secondary w-full"
              data-testid="manual-level-confirm"
              onClick={() => dispatch({ type: "MANUAL_LEVEL_CONFIRM", nowMs: Date.now() })}
            >
              <Check className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Looks level — ring is inside the template
            </button>
          )}
        </section>
      )}

      {(state.step === "captured" || state.step === "saving") && (
        <section className="space-y-3" data-testid="captured-step">
          <h2 className="font-heading text-section">Calibration captured</h2>
          <p className="text-body text-muted">
            Save it, then film in your camera app at 240fps slo-mo.{" "}
            <strong>Do not move the tripod</strong> — every clip you upload in
            the next 6 hours inherits this calibration.
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={save}
            disabled={state.step === "saving"}
          >
            <Camera className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {state.step === "saving" ? "Saving…" : "Save calibration"}
          </button>
        </section>
      )}

      {state.step === "done" && (
        <section className="space-y-2" data-testid="done-step">
          <h2 className="font-heading text-section">Ready to film</h2>
          <p className="text-body text-muted">
            Open your camera app, switch to slo-mo (240fps), record your
            throws. Do not move the tripod.
          </p>
        </section>
      )}

      {state.step === "error" && (
        <section className="space-y-3" data-testid="error-step">
          <p className="text-body text-status-danger-fg">{state.errorMessage}</p>
          <button type="button" className="btn-secondary w-full" onClick={() => dispatch({ type: "RETRY" })}>
            <RotateCcw className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Try again
          </button>
        </section>
      )}
    </div>
  );
}
