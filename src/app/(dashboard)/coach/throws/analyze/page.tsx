"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Athlete {
 id: string;
 user: { firstName: string; lastName: string };
}

type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
type DrillType = "FULL_THROW" | "STANDING" | "POWER_POSITION" | "HALF_TURN" | "GLIDE" | "SPIN" | "SOUTH_AFRICAN";
type CameraAngle = "SIDE" | "BEHIND" | "FRONT" | "DIAGONAL";

const EVENT_OPTIONS: { value: ThrowEvent; label: string }[] = [
 { value: "SHOT_PUT", label: "Shot Put" },
 { value: "DISCUS", label: "Discus" },
 { value: "HAMMER", label: "Hammer" },
 { value: "JAVELIN", label: "Javelin" },
];

const DRILL_OPTIONS: Record<ThrowEvent, { value: DrillType; label: string }[]> = {
 SHOT_PUT: [
 { value: "FULL_THROW", label: "Full Throw" },
 { value: "STANDING", label: "Stand Throw" },
 { value: "POWER_POSITION", label: "Power Position" },
 { value: "GLIDE", label: "Glide" },
 { value: "SPIN", label: "Spin" },
 { value: "SOUTH_AFRICAN", label: "South African Drill" },
 ],
 DISCUS: [
 { value: "FULL_THROW", label: "Full Throw" },
 { value: "STANDING", label: "Stand Throw" },
 { value: "POWER_POSITION", label: "Power Position" },
 { value: "HALF_TURN", label: "Half Turn" },
 { value: "SOUTH_AFRICAN", label: "South African Drill" },
 ],
 HAMMER: [
 { value: "FULL_THROW", label: "Full Throw" },
 { value: "STANDING", label: "Stand Throw" },
 { value: "POWER_POSITION", label: "Power Position" },
 ],
 JAVELIN: [
 { value: "FULL_THROW", label: "Full Throw" },
 { value: "STANDING", label: "Stand Throw" },
 { value: "POWER_POSITION", label: "Power Position" },
 { value: "HALF_TURN", label: "Half Turn" },
 ],
};

const CAMERA_OPTIONS: { value: CameraAngle; label: string; description: string }[] = [
 { value: "SIDE", label: "Side View", description: "Best for release angle & full kinetic chain" },
 { value: "BEHIND", label: "Behind View", description: "Good for rotation & balance" },
 { value: "FRONT", label: "Front View", description: "Good for block & release height" },
 { value: "DIAGONAL", label: "Diagonal View", description: "Compromise view, decent for overall" },
];

export default function ThrowFlowAnalyzePage() {
 const router = useRouter();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [athletes, setAthletes] = useState<Athlete[]>([]);
 const [step, setStep] = useState<1 | 2 | 3>(1);

 // Form state
 const [event, setEvent] = useState<ThrowEvent>("SHOT_PUT");
 const [drillType, setDrillType] = useState<DrillType>("FULL_THROW");
 const [cameraAngle, setCameraAngle] = useState<CameraAngle>("SIDE");
 const [athleteId, setAthleteId] = useState("");
 const [athleteHeight, setAthleteHeight] = useState("");
 const [implementWeight, setImplementWeight] = useState("");
 const [knownDistance, setKnownDistance] = useState("");

 // Video state
 const [videoFile, setVideoFile] = useState<File | null>(null);
 const [videoPreview, setVideoPreview] = useState("");
 const [extractionProgress, setExtractionProgress] = useState(0);
 const [extractedFrames, setExtractedFrames] = useState<string[]>([]);
 const [videoDuration, setVideoDuration] = useState(0);

 // Submit state
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
 fetch("/api/athletes")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setAthletes(data.data || []);
 })
 .catch(() => {});
 }, []);

 // Reset drill type when event changes
 useEffect(() => {
 const drills = DRILL_OPTIONS[event];
 if (!drills.find((d) => d.value === drillType)) {
 setDrillType(drills[0].value);
 }
 }, [event, drillType]);

 function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0];
 if (!file) return;

 // Validate file type
 const validTypes = ["video/mp4", "video/quicktime", "video/webm", "video/mov"];
 if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
 setError("Please upload a video file (MP4, MOV, or WebM)");
 return;
 }

 // Validate file size (100MB max)
 if (file.size > 100 * 1024 * 1024) {
 setError("Video must be under 100MB");
 return;
 }

 setVideoFile(file);
 setVideoPreview(URL.createObjectURL(file));
 setError("");
 setExtractedFrames([]);
 }

 async function extractFrames() {
 if (!videoFile) return;

 setStep(3);
 setExtractionProgress(0);
 setError("");

 try {
 const { extractFrames: extract } = await import("@/lib/throwflow/frame-extraction");
 const result = await extract(videoFile, (percent) => setExtractionProgress(percent));
 setExtractedFrames(result.frames);
 setVideoDuration(result.duration);
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : "Failed to extract frames";
 setError(message);
 setStep(2);
 }
 }

 async function handleSubmit() {
 if (extractedFrames.length === 0) return;

 setSubmitting(true);
 setError("");

 try {
 const { selectKeyFrames } = await import("@/lib/throwflow/frame-extraction");
 const { frames: keyFrames, indices: keyFrameIndices } = selectKeyFrames(extractedFrames, 8);

 const res = await fetch("/api/throwflow", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 event,
 drillType,
 cameraAngle,
 athleteId: athleteId || null,
 athleteHeight: athleteHeight ? parseFloat(athleteHeight) : null,
 implementWeight: implementWeight ? parseFloat(implementWeight) : null,
 knownDistance: knownDistance ? parseFloat(knownDistance) : null,
 keyFrames,
 keyFrameIndices,
 totalFrames: extractedFrames.length,
 videoDuration,
 }),
 });

 const data = await res.json();
 if (data.success) {
 router.push(`/coach/throws/analyze/${data.data.id}`);
 } else {
 setError(data.error || "Failed to start analysis");
 setSubmitting(false);
 }
 } catch {
 setError("Network error. Please try again.");
 setSubmitting(false);
 }
 }

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">ThrowFlow Analysis</h1>
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 AI-powered biomechanical video analysis for throwing events
 </p>
 </div>
 <Link
 href="/coach/throws/analyze/history"
 className="btn-secondary text-sm"
 >
 View History
 </Link>
 </div>

 {/* Step Indicator */}
 <div className="flex items-center gap-2">
 {[1, 2, 3].map((s) => (
 <div key={s} className="flex items-center gap-2">
 <div
 className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
 step >= s
 ? "bg-amber-500 text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
 }`}
 >
 {step > s ? (
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 ) : (
 s
 )}
 </div>
 {s < 3 && (
 <div
 className={`w-12 h-0.5 ${
 step > s ? "bg-amber-500" : "bg-[var(--color-bg-subtle)]"
 }`}
 />
 )}
 </div>
 ))}
 <span className="ml-2 text-sm text-[var(--color-text-2)]">
 {step === 1 && "Calibrate"}
 {step === 2 && "Upload Video"}
 {step === 3 && "Analyze"}
 </span>
 </div>

 {/* Step 1: Calibration */}
 {step === 1 && (
 <div className="card space-y-6 stagger-spring">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">
 Step 1: Calibration
 </h2>

 {/* Event Selection */}
 <div>
 <label className="label">Throwing Event</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
 {EVENT_OPTIONS.map((opt) => (
 <button
 key={opt.value}
 onClick={() => setEvent(opt.value)}
 className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
 event === opt.value
 ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
 : "border-[var(--color-border)] text-[var(--color-text-2)] hover:border-[var(--color-border-strong)]"
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>

 {/* Drill Type */}
 <div>
 <label className="label">Drill / Technique</label>
 <div className="flex flex-wrap gap-2 mt-1">
 {DRILL_OPTIONS[event].map((opt) => (
 <button
 key={opt.value}
 onClick={() => setDrillType(opt.value)}
 className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
 drillType === opt.value
 ? "bg-amber-500 text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]"
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>

 {/* Camera Angle */}
 <div>
 <label className="label">Camera Angle</label>
 <div className="grid grid-cols-2 gap-3 mt-1">
 {CAMERA_OPTIONS.map((opt) => (
 <button
 key={opt.value}
 onClick={() => setCameraAngle(opt.value)}
 className={`p-3 rounded-lg border-2 text-left transition-all ${
 cameraAngle === opt.value
 ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
 : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
 }`}
 >
 <div className={`text-sm font-medium ${
 cameraAngle === opt.value
 ? "text-amber-700 dark:text-amber-300"
 : "text-[var(--color-text-2)]"
 }`}>
 {opt.label}
 </div>
 <div className="text-xs text-[var(--color-text-2)] mt-0.5">
 {opt.description}
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* Athlete Selection */}
 <div>
 <label className="label">Athlete (Optional)</label>
 <select
 value={athleteId}
 onChange={(e) => setAthleteId(e.target.value)}
 className="input mt-1"
 >
 <option value="">No specific athlete</option>
 {athletes.map((a) => (
 <option key={a.id} value={a.id}>
 {a.user.firstName} {a.user.lastName}
 </option>
 ))}
 </select>
 </div>

 {/* Optional calibration inputs */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div>
 <label className="label">Athlete Height (cm)</label>
 <input
 type="number"
 value={athleteHeight}
 onChange={(e) => setAthleteHeight(e.target.value)}
 placeholder="e.g. 185"
 className="input mt-1"
 />
 <p className="text-xs text-[var(--color-text-3)] mt-1">Helps estimate scale</p>
 </div>
 <div>
 <label className="label">Implement Weight (kg)</label>
 <input
 type="number"
 value={implementWeight}
 onChange={(e) => setImplementWeight(e.target.value)}
 placeholder="e.g. 7.26"
 className="input mt-1"
 step="0.01"
 />
 <p className="text-xs text-[var(--color-text-3)] mt-1">For force calculations</p>
 </div>
 <div>
 <label className="label">Known Distance (m)</label>
 <input
 type="number"
 value={knownDistance}
 onChange={(e) => setKnownDistance(e.target.value)}
 placeholder="e.g. 18.5"
 className="input mt-1"
 step="0.01"
 />
 <p className="text-xs text-[var(--color-text-3)] mt-1">Enables efficiency analysis</p>
 </div>
 </div>

 <div className="flex justify-end">
 <button onClick={() => setStep(2)} className="btn-primary">
 Next: Upload Video
 </button>
 </div>
 </div>
 )}

 {/* Step 2: Video Upload */}
 {step === 2 && (
 <div className="card space-y-6">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">
 Step 2: Upload Video
 </h2>

 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
 <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Tips for best results</h3>
 <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
 <li>- Film from the {CAMERA_OPTIONS.find(c => c.value === cameraAngle)?.label.toLowerCase()} for this analysis</li>
 <li>- Keep camera steady (tripod recommended)</li>
 <li>- Ensure full throw is captured from setup to recovery</li>
 <li>- Good lighting helps AI identify body positions</li>
 <li>- 2-10 second clips work best</li>
 </ul>
 </div>

 {/* Upload area */}
 <div
 onClick={() => fileInputRef.current?.click()}
 className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
 videoFile
 ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
 : "border-[var(--color-border-strong)] hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10"
 }`}
 >
 <input
 ref={fileInputRef}
 type="file"
 accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
 onChange={handleFileSelect}
 className="hidden"
 />
 {videoFile ? (
 <div className="space-y-2">
 <svg className="w-10 h-10 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 <p className="text-sm font-medium text-[var(--color-text)]">{videoFile.name}</p>
 <p className="text-xs text-[var(--color-text-2)]">
 {(videoFile.size / 1024 / 1024).toFixed(1)} MB - Click to change
 </p>
 </div>
 ) : (
 <div className="space-y-2">
 <svg className="w-10 h-10 mx-auto text-[var(--color-text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
 </svg>
 <p className="text-sm font-medium text-[var(--color-text-2)]">
 Click to upload a video
 </p>
 <p className="text-xs text-[var(--color-text-2)]">
 MP4, MOV, or WebM up to 100MB
 </p>
 </div>
 )}
 </div>

 {/* Video preview */}
 {videoPreview && (
 <div className="rounded-lg overflow-hidden bg-black">
 <video
 src={videoPreview}
 controls
 playsInline
 className="w-full max-h-64 object-contain"
 />
 </div>
 )}

 {error && (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
 <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
 </div>
 )}

 <div className="flex justify-between">
 <button onClick={() => setStep(1)} className="btn-secondary">
 Back
 </button>
 <button
 onClick={extractFrames}
 disabled={!videoFile}
 className="btn-primary disabled:opacity-50"
 >
 Extract Frames & Analyze
 </button>
 </div>
 </div>
 )}

 {/* Step 3: Processing & Submit */}
 {step === 3 && (
 <div className="card space-y-6">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">
 Step 3: Analysis
 </h2>

 {/* Frame extraction progress */}
 {extractedFrames.length === 0 && !error && (
 <div className="space-y-3">
 <div className="flex items-center justify-between text-sm">
 <span className="text-[var(--color-text-2)]">Extracting frames...</span>
 <span className="font-medium text-[var(--color-text)]">{extractionProgress}%</span>
 </div>
 <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
 <div
 className="bg-amber-500 h-2 rounded-full transition-all duration-300"
 style={{ width: `${extractionProgress}%` }}
 />
 </div>
 </div>
 )}

 {/* Frame preview */}
 {extractedFrames.length > 0 && (
 <>
 <div>
 <p className="text-sm text-[var(--color-text-2)] mb-3">
 Extracted {extractedFrames.length} frames ({videoDuration.toFixed(1)}s video).
 8 key frames will be sent for AI analysis.
 </p>
 <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
 {extractedFrames.filter((_, i) => {
 // Show ~16 evenly-spaced preview frames
 const step = Math.max(1, Math.floor(extractedFrames.length / 16));
 return i % step === 0;
 }).slice(0, 16).map((frame, i) => (
 <div key={i} className="aspect-video rounded overflow-hidden bg-[var(--color-bg-subtle)]">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={frame} alt={`Frame ${i}`} className="w-full h-full object-cover" />
 </div>
 ))}
 </div>
 </div>

 {/* Calibration summary */}
 <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-4">
 <h3 className="text-sm font-medium text-[var(--color-text-2)] mb-2">Analysis Configuration</h3>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
 <div>
 <span className="text-[var(--color-text-2)]">Event:</span>
 <p className="font-medium text-[var(--color-text)]">
 {EVENT_OPTIONS.find((e) => e.value === event)?.label}
 </p>
 </div>
 <div>
 <span className="text-[var(--color-text-2)]">Drill:</span>
 <p className="font-medium text-[var(--color-text)]">
 {DRILL_OPTIONS[event].find((d) => d.value === drillType)?.label}
 </p>
 </div>
 <div>
 <span className="text-[var(--color-text-2)]">Camera:</span>
 <p className="font-medium text-[var(--color-text)]">
 {CAMERA_OPTIONS.find((c) => c.value === cameraAngle)?.label}
 </p>
 </div>
 <div>
 <span className="text-[var(--color-text-2)]">Frames:</span>
 <p className="font-medium text-[var(--color-text)]">{extractedFrames.length}</p>
 </div>
 </div>
 </div>

 {error && (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
 <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
 </div>
 )}

 <div className="flex justify-between">
 <button onClick={() => setStep(2)} className="btn-secondary" disabled={submitting}>
 Back
 </button>
 <button
 onClick={handleSubmit}
 disabled={submitting}
 className="btn-primary disabled:opacity-50 flex items-center gap-2"
 >
 {submitting ? (
 <>
 <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Sending to AI...
 </>
 ) : (
 <>
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 Run Analysis
 </>
 )}
 </button>
 </div>
 </>
 )}
 </div>
 )}
 </div>
 );
}
