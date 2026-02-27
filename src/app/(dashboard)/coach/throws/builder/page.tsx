"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import {
 EVENTS,
 IMPLEMENTS,
 SESSION_TYPES,
 TRAINING_PHASES,
 BLOCK_TYPES,
 TECHNIQUE_FOCUS,
 STRENGTH_DB,
 CLASSIFICATIONS,
 PHASE_RATIOS,
 REST_INTERVALS,
 EVENT_CODE_MAP,
 GENDER_CODE_MAP,
 serializeEvents,
 type ThrowEvent,
 type Gender,
 type SessionType,
 type TrainingPhase,
 type BlockType,
 type Classification,
} from "@/lib/throws/constants";
import { getRankedExercises } from "@/lib/throws/correlations";
import {
 validateSession,
 autoFixSequence,
 type SessionBlock,
 type ThrowingBlockConfig,
 type StrengthBlockConfig,
 type WarmupCooldownConfig,
 type NotesBlockConfig,
 type ValidationIssue,
} from "@/lib/throws/validation";

// ── Local block state type ──────────────────────────────────────────

interface BuilderBlock {
 id: string;
 blockType: BlockType;
 position: number;
 config: ThrowingBlockConfig | StrengthBlockConfig | WarmupCooldownConfig | NotesBlockConfig;
}

let blockIdCounter = 0;
function nextBlockId() {
 return `block-${++blockIdCounter}-${Date.now()}`;
}

// ── Severity styling ────────────────────────────────────────────────

const SEVERITY_STYLES = {
 CRITICAL: {
 bg: "bg-red-50 dark:bg-red-900/20",
 border: "border-red-300 dark:border-red-800",
 text: "text-red-700 dark:text-red-400",
 icon: "text-red-500",
 label: "BLOCKS ASSIGNMENT",
 },
 WARNING: {
 bg: "bg-amber-50 dark:bg-amber-900/20",
 border: "border-amber-300 dark:border-amber-800",
 text: "text-amber-700 dark:text-amber-400",
 icon: "text-amber-500",
 label: "WARNING",
 },
 INFO: {
 bg: "bg-blue-50 dark:bg-blue-900/20",
 border: "border-blue-300 dark:border-blue-800",
 text: "text-blue-700 dark:text-blue-400",
 icon: "text-blue-500",
 label: "INFO",
 },
};

// ── Block type border colors ────────────────────────────────────────

const BLOCK_BORDER_COLORS: Record<BlockType, string> = {
 WARMUP: "border-l-amber-400",
 THROWING: "border-l-orange-500",
 STRENGTH: "border-l-gray-400",
 PLYOMETRIC: "border-l-blue-500",
 COOLDOWN: "border-l-cyan-400",
 NOTES: "border-l-purple-400",
};

// ── Classification color chips ──────────────────────────────────────

const CLASSIFICATION_COLORS: Record<Classification, string> = {
 CE: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
 SD: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
 SP: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
 GP: "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]",
};

// ── Component ───────────────────────────────────────────────────────

export default function ThrowsSessionBuilder() {
 const router = useRouter();
 const { toast } = useToast();

 // Session metadata
 const [sessionName, setSessionName] = useState("");
 const [selectedEvents, setSelectedEvents] = useState<ThrowEvent[]>(["HAMMER"]);
 const [gender, setGender] = useState<Gender>("MALE");

 // Primary event (first selected) drives correlations / implements
 const event = selectedEvents[0] ?? "HAMMER";

 const toggleEvent = useCallback((ev: ThrowEvent) => {
 setSelectedEvents((prev) => {
 if (prev.includes(ev)) {
 if (prev.length <= 1) return prev; // must keep at least one
 return prev.filter((e) => e !== ev);
 }
 return [...prev, ev];
 });
 }, []);
 const [sessionType, setSessionType] = useState<SessionType>("THROWS_LIFT");
 const [targetPhase, setTargetPhase] = useState<TrainingPhase | "">("");
 const [sessionNotes, setSessionNotes] = useState("");

 // Blocks
 const [blocks, setBlocks] = useState<BuilderBlock[]>([]);
 const [dragIndex, setDragIndex] = useState<number | null>(null);
 const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
 const [saving, setSaving] = useState(false);

 // Validation
 const validationResult = validateSession(blocks as SessionBlock[]);

 // Correlation-ranked exercises for current event/gender/phase
 const rankedExercises = useMemo(() => {
 const eventCode = EVENT_CODE_MAP[event];
 const genderCode = GENDER_CODE_MAP[gender];
 // Use a default band that gives results (middle range)
 const bands = ["16-17", "50-55", "55-60", "60-65"];
 for (const band of bands) {
 const results = getRankedExercises(eventCode, genderCode, band);
 if (results.length > 0) return results.slice(0, 10);
 }
 return [];
 }, [event, gender]);

 // Phase ratios hint
 const phaseRatios = targetPhase ? PHASE_RATIOS[targetPhase] : null;
 const phaseRest = targetPhase ? REST_INTERVALS[targetPhase] : null;

 // ── Block management ──────────────────────────────────────────────

 const addBlock = useCallback((type: BlockType) => {
 const id = nextBlockId();
 let config: BuilderBlock["config"];

 switch (type) {
 case "THROWING":
 config = {
 event,
 implementWeight: "",
 implementWeightKg: 0,
 throwCount: 12,
 intensityMin: 85,
 intensityMax: 95,
 maxEffortThrows: 2,
 techniqueFocus: "FULL_THROW",
 notes: "",
 } as ThrowingBlockConfig;
 break;
 case "STRENGTH":
 config = {
 exercises: [{ name: "", sets: 4, reps: 3, percentage: 80, classification: "SP" }],
 } as StrengthBlockConfig;
 break;
 case "WARMUP":
 case "COOLDOWN":
 config = { duration: 15, drills: [] } as WarmupCooldownConfig;
 break;
 case "NOTES":
 config = { text: "", coachOnly: false } as NotesBlockConfig;
 break;
 default:
 config = { duration: 10, drills: [] } as WarmupCooldownConfig;
 }

 setBlocks((prev) => [...prev, { id, blockType: type, position: prev.length, config }]);
 }, [event]);

 const removeBlock = useCallback((index: number) => {
 setBlocks((prev) => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, position: i })));
 }, []);

 const updateBlockConfig = useCallback((index: number, update: Partial<BuilderBlock["config"]>) => {
 setBlocks((prev) =>
 prev.map((b, i) => (i === index ? { ...b, config: { ...b.config, ...update } } : b))
 );
 }, []);

 const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
 setBlocks((prev) => {
 const newBlocks = [...prev];
 const [moved] = newBlocks.splice(fromIndex, 1);
 newBlocks.splice(toIndex, 0, moved);
 return newBlocks.map((b, i) => ({ ...b, position: i }));
 });
 }, []);

 const handleAutoFix = useCallback(() => {
 const fixed = autoFixSequence(blocks as SessionBlock[]);
 setBlocks(fixed as BuilderBlock[]);
 toast("Blocks reordered: heavy → light", "success");
 }, [blocks, toast]);

 // ── Drag and drop ─────────────────────────────────────────────────

 const handleDragStart = (index: number) => setDragIndex(index);
 const handleDragOver = (e: React.DragEvent, index: number) => {
 e.preventDefault();
 setDragOverIndex(index);
 };
 const handleDragEnd = () => {
 if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
 moveBlock(dragIndex, dragOverIndex);
 }
 setDragIndex(null);
 setDragOverIndex(null);
 };

 // ── Estimated duration ────────────────────────────────────────────

 const estimatedDuration = blocks.reduce((sum, b) => {
 if (b.blockType === "WARMUP" || b.blockType === "COOLDOWN") {
 return sum + ((b.config as WarmupCooldownConfig).duration || 0);
 }
 if (b.blockType === "THROWING") {
 const tc = b.config as ThrowingBlockConfig;
 return sum + Math.ceil(tc.throwCount * 1.5);
 }
 if (b.blockType === "STRENGTH") {
 const sc = b.config as StrengthBlockConfig;
 return sum + sc.exercises.length * 8;
 }
 return sum + 5;
 }, 0);

 // ── Save session ──────────────────────────────────────────────────

 async function handleSave() {
 if (!sessionName.trim()) {
 toast("Please enter a session name", "error");
 return;
 }
 if (blocks.length === 0) {
 toast("Please add at least one block", "error");
 return;
 }
 if (!validationResult.canAssign) {
 toast("Fix critical validation errors before saving", "error");
 return;
 }

 setSaving(true);
 try {
 const res = await fetch("/api/throws/sessions", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 name: sessionName,
 sessionType,
 targetPhase: targetPhase || undefined,
 event: serializeEvents(selectedEvents),
 estimatedDuration,
 notes: sessionNotes || undefined,
 blocks: blocks.map((b) => ({
 blockType: b.blockType,
 position: b.position,
 config: b.config,
 })),
 }),
 });
 const data = await res.json();
 if (data.success) {
 toast("Session saved to library!", "success");
 router.push("/coach/throws/library");
 } else {
 toast(data.error || "Failed to save session", "error");
 }
 } catch {
 toast("Network error — please try again", "error");
 } finally {
 setSaving(false);
 }
 }

 // ── Available implements for current event + gender ────────────────

 const implements_ = IMPLEMENTS[event]?.[gender] || [];

 // ── Render ────────────────────────────────────────────────────────

 return (
 <div className="animate-spring-up">
 <div className="flex items-center justify-between mb-2">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Session Builder
 </h1>
 <p className="text-sm text-[var(--color-text-2)]">
 Build a Bondarchuk-validated throws practice session
 </p>
 </div>
 <div className="flex items-center gap-2">
 {estimatedDuration > 0 && (
 <span className="text-sm text-[var(--color-text-2)]">
 ~{estimatedDuration} min
 </span>
 )}
 <button
 onClick={handleSave}
 disabled={saving || !validationResult.canAssign}
 className="btn-primary"
 >
 {saving ? "Saving..." : "Save Session"}
 </button>
 </div>
 </div>

 <div className="flex gap-6 mt-4">
 {/* ── Left: Block toolbar + Phase info ─────────────────────── */}
 <div className="hidden lg:block w-52 flex-shrink-0 space-y-2">
 <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">
 Add Block
 </p>
 {BLOCK_TYPES.map((bt) => (
 <button
 key={bt.value}
 type="button"
 onClick={() => addBlock(bt.value)}
 className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-2)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-sm transition-all"
 >
 <span className="text-lg">{bt.icon}</span>
 {bt.label}
 </button>
 ))}

 {/* Phase ratios hint */}
 {phaseRatios && (
 <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
 <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">
 {targetPhase} Ratios
 </p>
 <div className="space-y-1">
 {(["CE", "SD", "SP", "GP"] as const).map((cls) => (
 <div key={cls} className="flex items-center gap-1.5">
 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CLASSIFICATION_COLORS[cls]}`}>
 {cls}
 </span>
 <div className="flex-1 h-2 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
 <div
 className="h-full rounded-full bg-[rgba(212,168,67,0.08)]0"
 style={{ width: `${phaseRatios[cls]}%` }}
 />
 </div>
 <span className="text-[10px] text-[var(--color-text-2)] w-6 text-right">{phaseRatios[cls]}%</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Rest intervals hint */}
 {phaseRest && (
 <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
 <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">
 Rest Intervals
 </p>
 <div className="space-y-1 text-[10px]">
 <div className="flex justify-between text-[var(--color-text-2)]">
 <span>CE throws</span><span>{phaseRest.CE}s</span>
 </div>
 <div className="flex justify-between text-[var(--color-text-2)]">
 <span>SD throws</span><span>{phaseRest.SD}s</span>
 </div>
 <div className="flex justify-between text-[var(--color-text-2)]">
 <span>SP (power)</span><span>{phaseRest.SP_power}s</span>
 </div>
 <div className="flex justify-between text-[var(--color-text-2)]">
 <span>SP (strength)</span><span>{phaseRest.SP_strength}s</span>
 </div>
 <div className="flex justify-between text-[var(--color-text-2)]">
 <span>GP</span><span>{phaseRest.GP}s</span>
 </div>
 </div>
 </div>
 )}

 {/* Top correlated exercises */}
 {rankedExercises.length > 0 && (
 <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
 <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">
 Top Correlations
 </p>
 <div className="space-y-1">
 {rankedExercises.slice(0, 5).map((ex, i) => (
 <div key={i} className="flex items-center gap-1.5">
 <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${CLASSIFICATION_COLORS[ex.type as Classification] || CLASSIFICATION_COLORS.SP}`}>
 {ex.type}
 </span>
 <span className="text-[10px] text-[var(--color-text-2)] truncate flex-1">{ex.exercise}</span>
 <span className="text-[10px] font-mono text-[var(--color-text-3)]">
 {ex.correlation.toFixed(2)}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Validation summary */}
 {blocks.length > 0 && (
 <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
 <p className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">
 Validation
 </p>
 {validationResult.issues.length === 0 ? (
 <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 All 7 rules pass
 </div>
 ) : (
 <div className="space-y-1">
 {validationResult.issues.filter((i) => i.severity === "CRITICAL").length > 0 && (
 <div className="text-xs text-red-600 dark:text-red-400 font-medium">
 {validationResult.issues.filter((i) => i.severity === "CRITICAL").length} critical
 </div>
 )}
 {validationResult.issues.filter((i) => i.severity === "WARNING").length > 0 && (
 <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
 {validationResult.issues.filter((i) => i.severity === "WARNING").length} warning(s)
 </div>
 )}
 {validationResult.issues.filter((i) => i.severity === "INFO").length > 0 && (
 <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
 {validationResult.issues.filter((i) => i.severity === "INFO").length} info
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>

 {/* ── Center: Main canvas ─────────────────────────────────── */}
 <div className="flex-1 min-w-0 space-y-4">
 {/* Session metadata card */}
 <div className="card space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="sm:col-span-2">
 <label className="label">Session Name *</label>
 <input
 className="input text-lg font-semibold"
 value={sessionName}
 onChange={(e) => setSessionName(e.target.value)}
 placeholder="e.g., HT Heavy Emphasis — Monday"
 />
 </div>
 <div>
 <label className="label">Events * <span className="text-xs font-normal text-[var(--color-text-3)]">(select one or more)</span></label>
 <div className="flex flex-wrap gap-2">
 {(Object.keys(EVENTS) as ThrowEvent[]).map((ev) => {
 const isSelected = selectedEvents.includes(ev);
 return (
 <button
 key={ev}
 type="button"
 onClick={() => toggleEvent(ev)}
 className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
 isSelected
 ? "text-white ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-900"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]"
 }`}
 style={isSelected ? { backgroundColor: EVENTS[ev].color, "--tw-ring-color": EVENTS[ev].color } as React.CSSProperties : undefined}
 >
 {isSelected && <span className="mr-1">&#10003;</span>}
 {EVENTS[ev].label}
 </button>
 );
 })}
 </div>
 </div>
 <div>
 <label className="label">Athlete Gender</label>
 <div className="flex gap-2">
 {(["MALE", "FEMALE"] as Gender[]).map((g) => (
 <button
 key={g}
 type="button"
 onClick={() => setGender(g)}
 className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
 gender === g
 ? "bg-[var(--color-gold)] text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]"
 }`}
 >
 {g === "MALE" ? "Men" : "Women"}
 </button>
 ))}
 </div>
 </div>
 <div>
 <label className="label">Session Type</label>
 <select
 className="input"
 value={sessionType}
 onChange={(e) => setSessionType(e.target.value as SessionType)}
 >
 {SESSION_TYPES.map((st) => (
 <option key={st.value} value={st.value}>{st.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="label">Training Phase</label>
 <select
 className="input"
 value={targetPhase}
 onChange={(e) => setTargetPhase(e.target.value as TrainingPhase | "")}
 >
 <option value="">Select phase</option>
 {TRAINING_PHASES.map((ph) => (
 <option key={ph.value} value={ph.value}>{ph.label}</option>
 ))}
 </select>
 {targetPhase && (
 <p className="text-[10px] text-[var(--color-text-3)] mt-1">
 {TRAINING_PHASES.find((p) => p.value === targetPhase)?.description}
 </p>
 )}
 </div>
 </div>
 <div>
 <label className="label">Coach Notes</label>
 <textarea
 className="input"
 rows={2}
 value={sessionNotes}
 onChange={(e) => setSessionNotes(e.target.value)}
 placeholder="Session goals, warm-up instructions..."
 />
 </div>
 </div>

 {/* Validation banners */}
 {validationResult.issues.map((issue, i) => (
 <ValidationBanner key={i} issue={issue} onAutoFix={handleAutoFix} />
 ))}

 {/* Block canvas */}
 {blocks.length === 0 ? (
 <div className="card text-center py-16">
 <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
 Start building your session
 </h3>
 <p className="text-sm text-[var(--color-text-2)] mb-6 max-w-md mx-auto">
 Add blocks from the left panel, or use the quick-start buttons below.
 The 7-rule Bondarchuk validation engine checks your session in real time.
 </p>
 <div className="flex flex-wrap justify-center gap-2">
 <button
 type="button"
 onClick={() => { addBlock("WARMUP"); addBlock("THROWING"); addBlock("STRENGTH"); addBlock("THROWING"); addBlock("COOLDOWN"); }}
 className="btn-primary"
 >
 Quick Start: Throws + Lift
 </button>
 <button
 type="button"
 onClick={() => { addBlock("WARMUP"); addBlock("THROWING"); addBlock("THROWING"); addBlock("THROWING"); addBlock("COOLDOWN"); }}
 className="btn-secondary"
 >
 Quick Start: Throws Only
 </button>
 </div>
 {/* Mobile: block type buttons */}
 <div className="flex flex-wrap justify-center gap-2 mt-6 lg:hidden">
 {BLOCK_TYPES.map((bt) => (
 <button
 key={bt.value}
 type="button"
 onClick={() => addBlock(bt.value)}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-2)] "
 >
 <span>{bt.icon}</span>
 {bt.label}
 </button>
 ))}
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 {blocks.map((block, index) => (
 <div
 key={block.id}
 draggable
 onDragStart={() => handleDragStart(index)}
 onDragOver={(e) => handleDragOver(e, index)}
 onDragEnd={handleDragEnd}
 className={`transition-all ${
 dragOverIndex === index ? "transform scale-[1.02] shadow-lg" : ""
 } ${dragIndex === index ? "opacity-50" : ""}`}
 >
 <BlockCard
 block={block}
 index={index}
 event={event}
 gender={gender}
 implements_={implements_}
 onRemove={() => removeBlock(index)}
 onUpdateConfig={(update) => updateBlockConfig(index, update)}
 />
 </div>
 ))}

 {/* Mobile: add block buttons */}
 <div className="flex flex-wrap gap-2 lg:hidden pt-2">
 {BLOCK_TYPES.map((bt) => (
 <button
 key={bt.value}
 type="button"
 onClick={() => addBlock(bt.value)}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-2)] "
 >
 <span>{bt.icon}</span>
 {bt.label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

// ── Validation Banner Component ─────────────────────────────────────

function ValidationBanner({ issue, onAutoFix }: { issue: ValidationIssue; onAutoFix: () => void }) {
 const style = SEVERITY_STYLES[issue.severity];

 return (
 <div className={`rounded-lg border-l-4 ${style.border} ${style.bg} p-3 flex items-start gap-3`}>
 <div className={`${style.icon} flex-shrink-0 mt-0.5`}>
 {issue.severity === "CRITICAL" ? (
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 ) : issue.severity === "WARNING" ? (
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 ) : (
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <span className={`text-[10px] font-bold uppercase ${style.text}`}>Rule {issue.rule}</span>
 <span className={`text-sm font-semibold ${style.text}`}>{issue.title}</span>
 </div>
 <p className={`text-sm ${style.text} opacity-90`}>{issue.message}</p>
 </div>
 {issue.autoFixable && (
 <button
 type="button"
 onClick={onAutoFix}
 className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
 >
 Auto-Fix
 </button>
 )}
 </div>
 );
}

// ── Block Card Component ────────────────────────────────────────────

function BlockCard({
 block,
 index,
 event,
 gender: _gender,
 implements_,
 onRemove,
 onUpdateConfig,
}: {
 block: BuilderBlock;
 index: number;
 event: ThrowEvent;
 gender: Gender;
 implements_: { weight: string; weightKg: number; isCompetition: boolean; label: string }[];
 onRemove: () => void;
 onUpdateConfig: (update: Partial<BuilderBlock["config"]>) => void;
}) {
 const blockMeta = BLOCK_TYPES.find((bt) => bt.value === block.blockType);

 return (
 <div className={`card !p-0 border-l-4 ${BLOCK_BORDER_COLORS[block.blockType]} overflow-hidden`}>
 {/* Block header */}
 <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface-2)]/50 border-b border-[var(--color-border)]">
 <div className="cursor-grab active:cursor-grabbing text-[var(--color-text-3)] hover:text-[var(--color-text-2)] ">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
 <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
 <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
 <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
 </svg>
 </div>
 <span className="text-lg">{blockMeta?.icon}</span>
 <span className="font-semibold text-[var(--color-text)] text-sm">
 {blockMeta?.label || block.blockType}
 </span>
 <span className="text-xs text-[var(--color-text-3)]">Block {index + 1}</span>
 <div className="flex-1" />
 <button
 type="button"
 onClick={onRemove}
 className="p-1 rounded text-[var(--color-text-3)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </div>

 {/* Block body */}
 <div className="px-4 py-4">
 {block.blockType === "THROWING" && (
 <ThrowingBlockEditor
 config={block.config as ThrowingBlockConfig}
 event={event}
 implements_={implements_}
 onUpdate={onUpdateConfig}
 />
 )}
 {block.blockType === "STRENGTH" && (
 <StrengthBlockEditor
 config={block.config as StrengthBlockConfig}
 onUpdate={onUpdateConfig}
 />
 )}
 {(block.blockType === "WARMUP" || block.blockType === "COOLDOWN") && (
 <WarmupCooldownEditor
 config={block.config as WarmupCooldownConfig}
 onUpdate={onUpdateConfig}
 />
 )}
 {block.blockType === "NOTES" && (
 <NotesBlockEditor
 config={block.config as NotesBlockConfig}
 onUpdate={onUpdateConfig}
 />
 )}
 {block.blockType === "PLYOMETRIC" && (
 <StrengthBlockEditor
 config={(block.config as StrengthBlockConfig).exercises ? block.config as StrengthBlockConfig : { exercises: [{ name: "", sets: 3, reps: 8, classification: "SP" }] }}
 onUpdate={onUpdateConfig}
 />
 )}
 </div>
 </div>
 );
}

// ── Throwing Block Editor ───────────────────────────────────────────

function ThrowingBlockEditor({
 config,
 event,
 implements_,
 onUpdate,
}: {
 config: ThrowingBlockConfig;
 event: ThrowEvent;
 implements_: { weight: string; weightKg: number; isCompetition: boolean; label: string }[];
 onUpdate: (update: Partial<ThrowingBlockConfig>) => void;
}) {
 return (
 <div className="space-y-4">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="col-span-2">
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Implement</label>
 <select
 className="input"
 value={config.implementWeight}
 onChange={(e) => {
 const impl = implements_.find((i) => i.weight === e.target.value);
 onUpdate({
 implementWeight: e.target.value,
 implementWeightKg: impl?.weightKg || 0,
 event,
 } as Partial<ThrowingBlockConfig>);
 }}
 >
 <option value="">Select implement...</option>
 {implements_.map((impl) => (
 <option key={impl.weight} value={impl.weight}>
 {impl.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Throws</label>
 <input
 type="number"
 className="exercise-input !text-left"
 min="1"
 value={config.throwCount || ""}
 onChange={(e) => onUpdate({ throwCount: parseInt(e.target.value) || 0 } as Partial<ThrowingBlockConfig>)}
 placeholder="12"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Max Effort</label>
 <input
 type="number"
 className="exercise-input !text-left"
 min="0"
 value={config.maxEffortThrows || ""}
 onChange={(e) => onUpdate({ maxEffortThrows: parseInt(e.target.value) || 0 } as Partial<ThrowingBlockConfig>)}
 placeholder="2"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Intensity: {config.intensityMin}–{config.intensityMax}%
 </label>
 <div className="flex items-center gap-2">
 <input
 type="range"
 min="60"
 max="100"
 value={config.intensityMin}
 onChange={(e) => {
 const val = parseInt(e.target.value);
 onUpdate({
 intensityMin: val,
 intensityMax: Math.max(val, config.intensityMax),
 } as Partial<ThrowingBlockConfig>);
 }}
 className="flex-1"
 style={{ accentColor: EVENTS[event]?.color || "#f97316" }}
 />
 <input
 type="range"
 min="60"
 max="100"
 value={config.intensityMax}
 onChange={(e) => {
 const val = parseInt(e.target.value);
 onUpdate({
 intensityMax: val,
 intensityMin: Math.min(val, config.intensityMin),
 } as Partial<ThrowingBlockConfig>);
 }}
 className="flex-1"
 style={{ accentColor: EVENTS[event]?.color || "#f97316" }}
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Technique</label>
 <select
 className="input"
 value={config.techniqueFocus || ""}
 onChange={(e) => onUpdate({ techniqueFocus: e.target.value } as Partial<ThrowingBlockConfig>)}
 >
 {TECHNIQUE_FOCUS.map((tf) => (
 <option key={tf.value} value={tf.value}>{tf.label}</option>
 ))}
 </select>
 </div>
 <div className="col-span-2 sm:col-span-1">
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Notes</label>
 <input
 className="input"
 value={config.notes || ""}
 onChange={(e) => onUpdate({ notes: e.target.value } as Partial<ThrowingBlockConfig>)}
 placeholder="Cues, focus points..."
 />
 </div>
 </div>
 </div>
 );
}

// ── Strength Block Editor ───────────────────────────────────────────

function StrengthBlockEditor({
 config,
 onUpdate,
}: {
 config: StrengthBlockConfig;
 onUpdate: (update: Partial<StrengthBlockConfig>) => void;
}) {
 const updateExercise = (idx: number, field: string, value: string | number) => {
 const updated = config.exercises.map((ex, i) =>
 i === idx ? { ...ex, [field]: value } : ex
 );
 onUpdate({ exercises: updated });
 };

 const selectFromDB = (idx: number, exerciseId: string) => {
 const dbEntry = STRENGTH_DB.find((e) => e.id === exerciseId);
 if (dbEntry) {
 const updated = config.exercises.map((ex, i) =>
 i === idx ? { ...ex, name: dbEntry.name, classification: dbEntry.classification } : ex
 );
 onUpdate({ exercises: updated });
 }
 };

 const addExercise = () => {
 onUpdate({
 exercises: [...config.exercises, { name: "", sets: 3, reps: 5, percentage: 75, classification: "SP" }],
 });
 };

 const removeExercise = (idx: number) => {
 onUpdate({ exercises: config.exercises.filter((_, i) => i !== idx) });
 };

 return (
 <div className="space-y-3">
 {config.exercises.map((ex, i) => (
 <div key={i} className="space-y-2">
 <div className="grid grid-cols-12 gap-2 items-end">
 <div className="col-span-4">
 {i === 0 && <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Exercise</label>}
 <select
 className="input"
 value={STRENGTH_DB.find((d) => d.name === ex.name)?.id || ""}
 onChange={(e) => {
 if (e.target.value) {
 selectFromDB(i, e.target.value);
 }
 }}
 >
 <option value="">Select exercise...</option>
 {Object.entries(CLASSIFICATIONS).map(([cls, meta]) => (
 <optgroup key={cls} label={`${cls} — ${meta.label}`}>
 {STRENGTH_DB.filter((d) => d.classification === cls).map((d) => (
 <option key={d.id} value={d.id}>
 {d.name} ({d.muscle})
 </option>
 ))}
 </optgroup>
 ))}
 </select>
 </div>
 <div className="col-span-2">
 {i === 0 && <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Sets</label>}
 <input
 type="number"
 className="exercise-input"
 min="1"
 value={ex.sets || ""}
 onChange={(e) => updateExercise(i, "sets", parseInt(e.target.value) || 0)}
 />
 </div>
 <div className="col-span-2">
 {i === 0 && <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Reps</label>}
 <input
 type="number"
 className="exercise-input"
 min="1"
 value={ex.reps || ""}
 onChange={(e) => updateExercise(i, "reps", parseInt(e.target.value) || 0)}
 />
 </div>
 <div className="col-span-2">
 {i === 0 && <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">% 1RM</label>}
 <input
 type="number"
 className="exercise-input"
 min="0"
 max="100"
 value={ex.percentage || ""}
 onChange={(e) => updateExercise(i, "percentage", parseInt(e.target.value) || 0)}
 />
 </div>
 <div className="col-span-1">
 {i === 0 && <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Type</label>}
 <span className={`block text-center text-[10px] font-bold px-1 py-1.5 rounded ${CLASSIFICATION_COLORS[ex.classification as Classification] || CLASSIFICATION_COLORS.GP}`}>
 {ex.classification}
 </span>
 </div>
 <div className="col-span-1 flex justify-center">
 {config.exercises.length > 1 && (
 <button
 type="button"
 onClick={() => removeExercise(i)}
 className="p-1 text-[var(--color-text-3)] hover:text-red-500 transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>
 </div>
 {ex.name && (
 <p className="text-[10px] text-[var(--color-text-3)] pl-1">
 {CLASSIFICATIONS[ex.classification as Classification]?.description || ""}
 </p>
 )}
 </div>
 ))}
 <button
 type="button"
 onClick={addExercise}
 className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] font-medium"
 >
 + Add exercise
 </button>
 </div>
 );
}

// ── Warmup / Cooldown Editor ────────────────────────────────────────

function WarmupCooldownEditor({
 config,
 onUpdate,
}: {
 config: WarmupCooldownConfig;
 onUpdate: (update: Partial<WarmupCooldownConfig>) => void;
}) {
 const [drillInput, setDrillInput] = useState("");

 const addDrill = () => {
 if (!drillInput.trim()) return;
 onUpdate({ drills: [...config.drills, drillInput.trim()] });
 setDrillInput("");
 };

 const removeDrill = (idx: number) => {
 onUpdate({ drills: config.drills.filter((_, i) => i !== idx) });
 };

 return (
 <div className="space-y-3">
 <div className="w-32">
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Duration (min)</label>
 <input
 type="number"
 className="exercise-input"
 min="1"
 value={config.duration || ""}
 onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || 0 })}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">Drills</label>
 <div className="flex flex-wrap gap-1.5 mb-2">
 {config.drills.map((drill, i) => (
 <span
 key={i}
 className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] "
 >
 {drill}
 <button
 type="button"
 onClick={() => removeDrill(i)}
 className="text-[var(--color-text-3)] hover:text-red-500"
 >
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </span>
 ))}
 </div>
 <div className="flex gap-2">
 <input
 className="input flex-1"
 value={drillInput}
 onChange={(e) => setDrillInput(e.target.value)}
 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDrill(); } }}
 placeholder="Type drill name, press Enter..."
 />
 <button type="button" onClick={addDrill} className="btn-secondary px-3">
 Add
 </button>
 </div>
 </div>
 </div>
 );
}

// ── Notes Block Editor ──────────────────────────────────────────────

function NotesBlockEditor({
 config,
 onUpdate,
}: {
 config: NotesBlockConfig;
 onUpdate: (update: Partial<NotesBlockConfig>) => void;
}) {
 return (
 <div className="space-y-3">
 <textarea
 className="input"
 rows={3}
 value={config.text}
 onChange={(e) => onUpdate({ text: e.target.value })}
 placeholder="Coach instructions, reminders, or athlete-facing notes..."
 />
 <label className="flex items-center gap-2 text-sm text-[var(--color-text-2)]">
 <input
 type="checkbox"
 checked={config.coachOnly}
 onChange={(e) => onUpdate({ coachOnly: e.target.checked })}
 className="rounded border-[var(--color-border-strong)] text-[var(--color-gold-dark)] focus:ring-[rgba(212,168,67,0.4)]"
 />
 Coach-only note (hidden from athletes)
 </label>
 </div>
 );
}
