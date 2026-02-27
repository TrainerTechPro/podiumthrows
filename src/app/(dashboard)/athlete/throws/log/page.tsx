"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import {
 LineChart,
 Line,
 XAxis,
 YAxis,
 Tooltip,
 ResponsiveContainer,
 CartesianGrid,
 Legend,
} from "recharts";

// ── Constants ──────────────────────────────────────────────────────────

const THROW_EVENTS = [
 { value: "SHOT_PUT", label: "Shot Put", color: "#E85D26", icon: "⚫" },
 { value: "DISCUS", label: "Discus", color: "#2563EB", icon: "🥏" },
 { value: "HAMMER", label: "Hammer", color: "#7C3AED", icon: "🔨" },
 { value: "JAVELIN", label: "Javelin", color: "#059669", icon: "🏹" },
] as const;

const DRILL_TYPES = [
 { value: "STANDING", label: "Standing Throw", short: "Stand" },
 { value: "POWER_POSITION", label: "Power Position", short: "Power Pos" },
 { value: "HALF_TURN", label: "Half Turn", short: "Half Turn" },
 { value: "SOUTH_AFRICAN", label: "South African", short: "S. African" },
 { value: "GLIDE", label: "Glide", short: "Glide" },
 { value: "SPIN", label: "Full Spin", short: "Full Spin" },
 { value: "FULL_THROW", label: "Full Throw (run-up)", short: "Full Throw" },
] as const;

// Common implement weights per event (kg)
const EVENT_IMPLEMENTS: Record<string, number[]> = {
 SHOT_PUT: [4, 5, 6, 7.26, 8, 9],
 DISCUS: [1, 1.5, 2, 2.5],
 HAMMER: [4, 6, 7.26, 9, 10],
 JAVELIN: [600, 700, 800],
};

const TREND_COLORS = [
 "#E85D26","#2563EB","#7C3AED","#059669","#D97706","#DB2777","#0891B2","#65A30D",
];

// ── Drill row type ─────────────────────────────────────────────────────

interface DrillRow {
 id: string;
 drillType: string;
 implementWeight: string;
 implementUnit: "kg" | "lbs";
 throwCount: number;
 bestMark: string;
 notes: string;
}

function newDrill(drillType = "STANDING"): DrillRow {
 return { id: crypto.randomUUID(), drillType, implementWeight: "", implementUnit: "kg", throwCount: 0, bestMark: "", notes: "" };
}

// ── Trend types ────────────────────────────────────────────────────────

interface TrendPoint { date: string; bestMark: number; throwCount: number }
interface TrendSeries { key: string; drillType: string; implement: string; points: TrendPoint[] }

// ── Format date for display ────────────────────────────────────────────

function fmtDate(d: string) {
 return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Implement weight quick-pick buttons ────────────────────────────────

function ImplementPicker({ event, value, onChange }: { event: string; value: string; onChange: (v: string) => void }) {
 const weights = EVENT_IMPLEMENTS[event] ?? [];
 return (
 <div className="flex flex-wrap gap-1 mt-1">
 {weights.map((w) => (
 <button
 key={w}
 type="button"
 onClick={() => onChange(String(w))}
 className={`px-2 py-0.5 text-[10px] font-bold rounded-full border transition-colors ${
 value === String(w)
 ? "bg-[var(--color-gold)] text-white border-[var(--color-gold)]"
 : "border-[var(--color-border-strong)] text-[var(--color-text-2)] hover:border-[var(--color-gold)]"
 }`}
 >
 {w}kg
 </button>
 ))}
 </div>
 );
}

// ── Drill Card ─────────────────────────────────────────────────────────

function DrillCard({
 drill,
 event,
 onChange,
 onRemove,
 canRemove,
}: {
 drill: DrillRow;
 event: string;
 onChange: (updated: DrillRow) => void;
 onRemove: () => void;
 canRemove: boolean;
}) {
 function update(patch: Partial<DrillRow>) { onChange({ ...drill, ...patch }); }

 const _drillMeta = DRILL_TYPES.find((d) => d.value === drill.drillType);

 return (
 <div className="card !p-4 space-y-3">
 {/* Header */}
 <div className="flex items-center justify-between">
 <select
 value={drill.drillType}
 onChange={(e) => update({ drillType: e.target.value })}
 className="text-sm font-semibold bg-transparent text-[var(--color-text)] border-none outline-none cursor-pointer pr-2"
 >
 {DRILL_TYPES.map((dt) => (
 <option key={dt.value} value={dt.value}>{dt.label}</option>
 ))}
 </select>
 {canRemove && (
 <button
 type="button"
 onClick={onRemove}
 className="text-[var(--color-text-3)] hover:text-red-500 transition-colors"
 aria-label="Remove drill"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>

 <div className="grid grid-cols-2 gap-3">
 {/* Implement weight */}
 <div className="space-y-1">
 <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)]">
 Implement
 </label>
 <div className="flex items-center gap-1">
 <input
 type="number"
 step="0.1"
 min="0"
 value={drill.implementWeight}
 onChange={(e) => update({ implementWeight: e.target.value })}
 placeholder="—"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 <button
 type="button"
 onClick={() => update({ implementUnit: drill.implementUnit === "kg" ? "lbs" : "kg" })}
 className="shrink-0 px-1.5 py-1 text-[10px] font-bold border border-[var(--color-border-strong)] rounded text-[var(--color-text-2)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
 >
 {drill.implementUnit}
 </button>
 </div>
 <ImplementPicker event={event} value={drill.implementWeight} onChange={(v) => update({ implementWeight: v })} />
 </div>

 {/* Best mark */}
 <div className="space-y-1">
 <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)]">
 Best Mark (m)
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={drill.bestMark}
 onChange={(e) => update({ bestMark: e.target.value })}
 placeholder="Optional"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 </div>

 {/* Throw count stepper */}
 <div className="flex items-center gap-3">
 <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] shrink-0">
 Throws
 </label>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => update({ throwCount: Math.max(0, drill.throwCount - 1) })}
 className="w-8 h-8 rounded-lg bg-[var(--color-bg-subtle)] flex items-center justify-center text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] transition-colors font-bold text-lg"
 >
 −
 </button>
 <span className="w-8 text-center text-base font-bold text-[var(--color-text)] tabular-nums">
 {drill.throwCount}
 </span>
 <button
 type="button"
 onClick={() => update({ throwCount: drill.throwCount + 1 })}
 className="w-8 h-8 rounded-lg bg-[var(--color-bg-subtle)] flex items-center justify-center text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] transition-colors font-bold text-lg"
 >
 +
 </button>
 <span className="text-xs text-[var(--color-text-3)] ml-1">throws</span>
 </div>
 </div>

 {/* Notes */}
 <input
 type="text"
 value={drill.notes}
 onChange={(e) => update({ notes: e.target.value })}
 placeholder="Drill notes (optional)"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-3)]"
 />
 </div>
 );
}

// ── Trends View ────────────────────────────────────────────────────────

function TrendsView({ athleteId, onLogSession }: { athleteId: string | null; onLogSession: () => void }) {
 const [trends, setTrends] = useState<TrendSeries[]>([]);
 const [volumeByDate, setVolumeByDate] = useState<Record<string, number>>({});
 const [sessionCount, setSessionCount] = useState(0);
 const [loading, setLoading] = useState(true);
 const [filterEvent, setFilterEvent] = useState("");
 const [filterDrill, setFilterDrill] = useState("");

 const loadTrends = useCallback(async () => {
 if (!athleteId) return;
 setLoading(true);
 const params = new URLSearchParams({ athleteId });
 if (filterEvent) params.set("event", filterEvent);
 const url = `/api/throws/athlete-sessions/trends?${params}`;
 try {
 const res = await fetch(url);
 const data = await res.json();
 if (data.success) {
 setTrends(data.data.trends);
 setVolumeByDate(data.data.volumeByDate);
 setSessionCount(data.data.sessionCount);
 }
 } catch { /* ignore */ }
 setLoading(false);
 }, [athleteId, filterEvent]);

 useEffect(() => { loadTrends(); }, [loadTrends]);

 const drillLabel = (key: string) => DRILL_TYPES.find((d) => d.value === key)?.label ?? key;

 const filteredTrends = filterDrill
 ? trends.filter((t) => t.drillType === filterDrill)
 : trends;

 // Build unified date list for volume chart
 const volDates = Object.keys(volumeByDate).sort();
 const volData = volDates.map((d) => ({ date: fmtDate(d), throws: volumeByDate[d] }));

 if (loading) return (
 <div className="space-y-4">
 {[1,2,3].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
 </div>
 );

 if (sessionCount === 0) return (
 <div className="card">
 <EmptyState
 headline="No throws logged yet"
 subtext="Log your first session to see trends"
 ctaLabel="Log a Session"
 ctaOnClick={onLogSession}
 />
 </div>
 );

 return (
 <div className="space-y-5">
 {/* Filters */}
 <div className="flex flex-wrap gap-2">
 <select
 value={filterEvent}
 onChange={(e) => setFilterEvent(e.target.value)}
 className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 <option value="">All Events</option>
 {THROW_EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
 </select>
 <select
 value={filterDrill}
 onChange={(e) => setFilterDrill(e.target.value)}
 className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 <option value="">All Drills</option>
 {DRILL_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
 </select>
 <span className="self-center text-xs text-[var(--color-text-3)]">{sessionCount} sessions total</span>
 </div>

 {/* Best mark trend chart */}
 {filteredTrends.length > 0 && (
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)]">Best Mark Progression</h3>
 <p className="text-xs text-[var(--color-text-2)]">Best throw per drill type and implement weight over time</p>
 <ResponsiveContainer width="100%" height={240}>
 <LineChart margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
 <XAxis
 dataKey="date"
 type="category"
 allowDuplicatedCategory={false}
 tick={{ fontSize: 11 }}
 tickFormatter={fmtDate}
 />
 <YAxis tick={{ fontSize: 11 }} />
 <Tooltip
 formatter={(val: number) => [`${val.toFixed(2)}m`, ""]}
 labelFormatter={(l) => `Date: ${l}`}
 />
 <Legend wrapperStyle={{ fontSize: 10 }} />
 {filteredTrends.map((series, i) => (
 <Line
 key={series.key}
 data={series.points.map((p) => ({ date: fmtDate(p.date), bestMark: p.bestMark }))}
 type="monotone"
 dataKey="bestMark"
 name={`${drillLabel(series.drillType)} ${series.implement}`}
 stroke={TREND_COLORS[i % TREND_COLORS.length]}
 strokeWidth={2}
 dot={{ r: 3 }}
 activeDot={{ r: 5 }}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Volume chart */}
 {volData.length > 0 && (
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)]">Session Volume</h3>
 <p className="text-xs text-[var(--color-text-2)]">Total throws logged per session date</p>
 <ResponsiveContainer width="100%" height={160}>
 <LineChart data={volData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
 <XAxis dataKey="date" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} />
 <Tooltip formatter={(val: number) => [`${val} throws`, "Volume"]} />
 <Line type="monotone" dataKey="throws" stroke="#E85D26" strokeWidth={2} dot={{ r: 3 }} />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}

 {/* Per-drill best mark table */}
 {filteredTrends.length > 0 && (
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)]">All-Time Bests</h3>
 <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
 {filteredTrends.map((series) => {
 const best = Math.max(...series.points.map((p) => p.bestMark));
 const totalThrows = series.points.reduce((s, p) => s + p.throwCount, 0);
 return (
 <div key={series.key} className="py-2.5 flex items-center justify-between">
 <div>
 <p className="text-sm font-semibold text-[var(--color-text)]">{drillLabel(series.drillType)}</p>
 <p className="text-xs text-[var(--color-text-2)]">{series.implement} · {series.points.length} sessions · {totalThrows} throws</p>
 </div>
 <span className="text-base font-bold font-mono text-orange-600 dark:text-orange-400">{best.toFixed(2)}m</span>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {filteredTrends.length === 0 && (
 <div className="card text-center py-8">
 <p className="text-sm text-[var(--color-text-3)]">No mark data for the selected filters.</p>
 </div>
 )}
 </div>
 );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ThrowsLogPage() {
 const [tab, setTab] = useState<"log" | "trends">("log");
 const [step, setStep] = useState<1 | 2 | 3>(1);
 const [athleteId, setAthleteId] = useState<string | null>(null);

 // Fetch own athleteId once on mount
 useEffect(() => {
 fetch("/api/auth/me")
 .then((r) => r.json())
 .then((d) => { if (d.success) setAthleteId(d.data.athleteProfile?.id ?? null); })
 .catch(() => {});
 }, []);

 // Log state
 const [selectedEvent, setSelectedEvent] = useState("");
 const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
 const [drills, setDrills] = useState<DrillRow[]>([newDrill("STANDING")]);
 const [sessionNotes, setSessionNotes] = useState("");
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);

 function resetForm() {
 setStep(1);
 setSelectedEvent("");
 setDate(new Date().toISOString().split("T")[0]);
 setDrills([newDrill("STANDING")]);
 setSessionNotes("");
 setSaved(false);
 }

 function addDrill() {
 setDrills((prev) => [...prev, newDrill()]);
 }

 function updateDrill(id: string, updated: DrillRow) {
 setDrills((prev) => prev.map((d) => (d.id === id ? updated : d)));
 }

 function removeDrill(id: string) {
 setDrills((prev) => prev.filter((d) => d.id !== id));
 }

 async function handleSave() {
 setSaving(true);
 const drillLogs = drills
 .filter((d) => d.throwCount > 0 || d.bestMark)
 .map((d) => {
 const implKg = d.implementUnit === "lbs" && d.implementWeight
 ? parseFloat(d.implementWeight) / 2.20462
 : parseFloat(d.implementWeight) || null;
 return {
 drillType: d.drillType,
 implementWeight: implKg,
 throwCount: d.throwCount,
 bestMark: d.bestMark ? parseFloat(d.bestMark) : null,
 notes: d.notes || null,
 };
 });

 try {
 const res = await fetch("/api/throws/athlete-sessions", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ athleteId, event: selectedEvent, date, notes: sessionNotes || null, drillLogs }),
 });
 const data = await res.json();
 if (data.success) setSaved(true);
 } catch { /* ignore */ }
 setSaving(false);
 }

 const eventMeta = THROW_EVENTS.find((e) => e.value === selectedEvent);

 const tabCls = (t: "log" | "trends") =>
 `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
 tab === t
 ? "bg-orange-500 text-white"
 : "text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)]"
 }`;

 return (
 <div className="animate-spring-up space-y-5 max-w-2xl mx-auto pb-8">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-bold text-[var(--color-text)]">Throws Session</h1>
 <p className="text-sm text-[var(--color-text-2)]">Log drills, marks, and track your progress</p>
 </div>
 <Link href="/athlete/throws" className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:underline">
 ← Throws
 </Link>
 </div>

 {/* Tab switcher */}
 <div className="flex gap-1 bg-[var(--color-bg-subtle)] rounded-xl p-1">
 <button onClick={() => setTab("log")} className={tabCls("log")}>
 <svg className="w-4 h-4 inline -mt-0.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Log Session
 </button>
 <button onClick={() => setTab("trends")} className={tabCls("trends")}>
 <svg className="w-4 h-4 inline -mt-0.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
 </svg>
 Trends
 </button>
 </div>

 {/* ── LOG TAB ──────────────────────────────────────────────── */}
 {tab === "log" && (
 <>
 {saved ? (
 /* Success state */
 <div className="card !p-6 text-center space-y-4">
 <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
 <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <div>
 <p className="text-lg font-bold text-[var(--color-text)]">Session Logged!</p>
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 Your {eventMeta?.label} session on {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} has been saved.
 </p>
 </div>
 <div className="flex gap-3">
 <button onClick={resetForm} className="flex-1 btn-secondary text-sm py-2.5">
 Log Another
 </button>
 <button onClick={() => setTab("trends")} className="flex-1 btn-primary text-sm py-2.5">
 View Trends →
 </button>
 </div>
 </div>
 ) : (
 <>
 {/* Step 1 — Event + Date */}
 {step === 1 && (
 <div className="space-y-5">
 <div>
 <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-2)] mb-3">
 Select Event
 </p>
 <div className="grid grid-cols-2 gap-3">
 {THROW_EVENTS.map((ev) => (
 <button
 key={ev.value}
 type="button"
 onClick={() => setSelectedEvent(ev.value)}
 className={`relative rounded-xl p-4 text-left transition-all border-2 ${
 selectedEvent === ev.value
 ? "border-transparent shadow-lg scale-[1.02]"
 : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
 }`}
 style={selectedEvent === ev.value ? { backgroundColor: ev.color, borderColor: ev.color } : {}}
 >
 <div className="text-2xl mb-2">{ev.icon}</div>
 <p className={`text-sm font-bold ${selectedEvent === ev.value ? "text-white" : "text-[var(--color-text)]"}`}>
 {ev.label}
 </p>
 {selectedEvent === ev.value && (
 <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
 <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
 </svg>
 </div>
 )}
 </button>
 ))}
 </div>
 </div>

 <div className="space-y-1">
 <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-2)]">
 Session Date
 </label>
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>

 <button
 onClick={() => setStep(2)}
 disabled={!selectedEvent}
 className="w-full btn-primary py-3 text-sm font-semibold disabled:opacity-40"
 style={selectedEvent ? { backgroundColor: eventMeta?.color, borderColor: eventMeta?.color } : {}}
 >
 Next: Log Drills →
 </button>
 </div>
 )}

 {/* Step 2 — Drills */}
 {step === 2 && (
 <div className="space-y-4">
 {/* Event badge + back */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <button onClick={() => setStep(1)} className="text-[var(--color-text-3)] hover:text-[var(--color-text-2)] transition-colors">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <span
 className="px-3 py-1 rounded-full text-xs font-bold text-white"
 style={{ backgroundColor: eventMeta?.color }}
 >
 {eventMeta?.label} · {new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
 </span>
 </div>
 <span className="text-xs text-[var(--color-text-3)]">{drills.length} drill{drills.length !== 1 ? "s" : ""}</span>
 </div>

 {/* Drill cards */}
 {drills.map((drill) => (
 <DrillCard
 key={drill.id}
 drill={drill}
 event={selectedEvent}
 onChange={(updated) => updateDrill(drill.id, updated)}
 onRemove={() => removeDrill(drill.id)}
 canRemove={drills.length > 1}
 />
 ))}

 {/* Add drill button */}
 <button
 type="button"
 onClick={addDrill}
 className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-border-strong)] text-sm font-semibold text-[var(--color-text-2)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors flex items-center justify-center gap-2"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Another Drill
 </button>

 <button
 onClick={() => setStep(3)}
 className="w-full btn-primary py-3 text-sm font-semibold"
 style={{ backgroundColor: eventMeta?.color, borderColor: eventMeta?.color }}
 >
 Next: Review & Save →
 </button>
 </div>
 )}

 {/* Step 3 — Review */}
 {step === 3 && (
 <div className="space-y-4">
 {/* Back button + header */}
 <div className="flex items-center gap-2">
 <button onClick={() => setStep(2)} className="text-[var(--color-text-3)] hover:text-[var(--color-text-2)] transition-colors">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <span className="text-sm font-semibold text-[var(--color-text-2)]">Review Session</span>
 </div>

 {/* Summary */}
 <div className="card !p-4 space-y-3">
 <div className="flex items-center gap-2">
 <span
 className="px-3 py-1 rounded-full text-xs font-bold text-white"
 style={{ backgroundColor: eventMeta?.color }}
 >
 {eventMeta?.label}
 </span>
 <span className="text-sm text-[var(--color-text-2)]">
 {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
 </span>
 </div>

 <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
 {drills.map((drill) => {
 const meta = DRILL_TYPES.find((d) => d.value === drill.drillType);
 return (
 <div key={drill.id} className="py-2.5 flex items-center justify-between">
 <div>
 <p className="text-sm font-semibold text-[var(--color-text)]">{meta?.label}</p>
 <p className="text-xs text-[var(--color-text-2)]">
 {drill.implementWeight ? `${drill.implementWeight}${drill.implementUnit}` : "No implement"} · {drill.throwCount} throw{drill.throwCount !== 1 ? "s" : ""}
 </p>
 </div>
 {drill.bestMark && (
 <span className="text-base font-bold font-mono text-orange-600 dark:text-orange-400">
 {parseFloat(drill.bestMark).toFixed(2)}m
 </span>
 )}
 </div>
 );
 })}
 </div>

 <div className="pt-1 text-xs text-[var(--color-text-3)]">
 Total: {drills.reduce((s, d) => s + d.throwCount, 0)} throws across {drills.length} drill{drills.length !== 1 ? "s" : ""}
 </div>
 </div>

 {/* Session notes */}
 <div className="space-y-1">
 <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-2)]">
 Session Notes (optional)
 </label>
 <textarea
 value={sessionNotes}
 onChange={(e) => setSessionNotes(e.target.value)}
 placeholder="How did it go? Weather, energy, technique cues..."
 rows={3}
 className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] resize-none"
 />
 </div>

 <button
 onClick={handleSave}
 disabled={saving}
 className="w-full py-3.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-60"
 style={{ backgroundColor: eventMeta?.color }}
 >
 {saving ? "Saving..." : "Save Session"}
 </button>
 </div>
 )}
 </>
 )}
 </>
 )}

 {/* ── TRENDS TAB ────────────────────────────────────────────── */}
 {tab === "trends" && <TrendsView athleteId={athleteId} onLogSession={() => setTab("log")} />}
 </div>
 );
}
