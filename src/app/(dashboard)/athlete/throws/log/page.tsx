"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { localToday } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { csrfHeaders } from "@/lib/csrf-client";
import { WIRE_LENGTH_OPTIONS, LBS_TO_KG, formatImplementWeight } from "@/lib/throws";
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
 wireLength: string; // FULL | THREE_QUARTER | HALF — hammer only
 throwCount: number;
 bestMark: string;
 notes: string;
}

function newDrill(drillType = "FULL_THROW"): DrillRow {
 return { id: crypto.randomUUID(), drillType, implementWeight: "", implementUnit: "kg", wireLength: "FULL", throwCount: 0, bestMark: "", notes: "" };
}

// ── Trend types ────────────────────────────────────────────────────────

interface TrendPoint { date: string; bestMark: number; throwCount: number }
interface TrendSeries { key: string; drillType: string; implement: string; points: TrendPoint[] }

// ── Format date for display ────────────────────────────────────────────

function fmtDate(d: string) {
 return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Implement weight quick-pick buttons ────────────────────────────────

function ImplementPicker({ event, value, onChange, onUnitReset }: { event: string; value: string; onChange: (v: string) => void; onUnitReset?: () => void }) {
 const weights = EVENT_IMPLEMENTS[event] ?? [];
 return (
 <div className="flex flex-wrap gap-1 mt-1">
 {weights.map((w) => (
 <button
 key={w}
 type="button"
 onClick={() => { onChange(String(w)); onUnitReset?.(); }}
 className={`px-2.5 py-1.5 text-xs sm:px-2 sm:py-0.5 sm:text-[10px] font-bold rounded-full border transition-colors ${
 value === String(w)
 ? "bg-primary-500 text-white border-primary-500"
 : "border-[var(--color-border-strong)] text-surface-700 dark:text-surface-300 hover:border-primary-500"
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
 pastDrills,
 onChange,
 onRemove,
 canRemove,
}: {
 drill: DrillRow;
 event: string;
 pastDrills: string[];
 onChange: (updated: DrillRow) => void;
 onRemove: () => void;
 canRemove: boolean;
}) {
 function update(patch: Partial<DrillRow>) { onChange({ ...drill, ...patch }); }

 const [showAllDrills, setShowAllDrills] = useState(false);
 const hasPastDrills = pastDrills.length > 0;
 const isHammer = event === "HAMMER";

 return (
 <div className="card !p-4 space-y-3">
 {/* Drill type selector */}
 <div className="flex items-center justify-between">
 <div className="flex-1">
 {hasPastDrills && !showAllDrills ? (
 <div className="flex flex-wrap gap-1.5">
 {pastDrills.map((dt) => {
 const meta = DRILL_TYPES.find((d) => d.value === dt);
 return (
 <button
 key={dt}
 type="button"
 onClick={() => update({ drillType: dt })}
 className={`px-3 py-2 text-xs sm:px-2.5 sm:py-1 sm:text-[11px] font-semibold rounded-lg transition-colors ${
 drill.drillType === dt
 ? "bg-primary-500 text-white"
 : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
 }`}
 >
 {meta?.short ?? dt}
 </button>
 );
 })}
 <button
 type="button"
 onClick={() => setShowAllDrills(true)}
 className="px-3 py-2 text-xs sm:px-2.5 sm:py-1 sm:text-[11px] font-semibold rounded-lg border border-dashed border-[var(--color-border-strong)] text-muted hover:text-primary-600 hover:border-primary-500 transition-colors"
 >
 + New Drill
 </button>
 </div>
 ) : (
 <select
 value={drill.drillType}
 onChange={(e) => update({ drillType: e.target.value })}
 className="text-sm font-semibold bg-transparent text-[var(--foreground)] border-none outline-none cursor-pointer pr-2"
 >
 {DRILL_TYPES.map((dt) => (
 <option key={dt.value} value={dt.value}>{dt.label}</option>
 ))}
 </select>
 )}
 </div>
 {canRemove && (
 <button
 type="button"
 onClick={onRemove}
 className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-red-500 transition-colors ml-2"
 aria-label="Remove drill"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {/* Implement weight */}
 <div className="space-y-1">
 <label className="text-[10px] font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
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
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)]"
 />
 <button
 type="button"
 onClick={() => update({ implementUnit: drill.implementUnit === "kg" ? "lbs" : "kg" })}
 className="shrink-0 px-2 py-1.5 text-xs sm:px-1.5 sm:py-1 sm:text-[10px] font-bold border border-[var(--color-border-strong)] rounded text-surface-700 dark:text-surface-300 hover:border-primary-500 hover:text-primary-600 transition-colors"
 >
 {drill.implementUnit}
 </button>
 </div>
 <ImplementPicker event={event} value={drill.implementWeight} onChange={(v) => update({ implementWeight: v })} onUnitReset={() => update({ implementUnit: "kg" })} />
 </div>

 {/* Best mark */}
 <div className="space-y-1">
 <label className="text-[10px] font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
 Best Mark (m)
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={drill.bestMark}
 onChange={(e) => update({ bestMark: e.target.value })}
 placeholder="Optional"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)]"
 />
 </div>
 </div>

 {/* Hammer wire length */}
 {isHammer && (
 <div className="flex items-center gap-2">
 <label className="text-[10px] font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 shrink-0">
 Wire
 </label>
 <div className="flex gap-1">
 {WIRE_LENGTH_OPTIONS.map((wl) => (
 <button
 key={wl.value}
 type="button"
 onClick={() => update({ wireLength: wl.value })}
 className={`px-3 py-2 text-xs sm:px-2.5 sm:py-1 sm:text-[10px] font-bold rounded-lg transition-colors ${
 drill.wireLength === wl.value
 ? "bg-purple-600 text-white"
 : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
 }`}
 >
 {wl.label}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Throw count stepper */}
 <div className="flex items-center gap-3">
 <label className="text-[10px] font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 shrink-0">
 Throws
 </label>
 <div className="flex items-center gap-3 sm:gap-2">
 <button
 type="button"
 onClick={() => update({ throwCount: Math.max(0, drill.throwCount - 1) })}
 className="w-8 h-8 rounded-lg bg-[var(--muted-bg)] flex items-center justify-center text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)] transition-colors font-bold text-lg"
 >
 −
 </button>
 <span className="w-8 text-center text-base font-bold text-[var(--foreground)] tabular-nums">
 {drill.throwCount}
 </span>
 <button
 type="button"
 onClick={() => update({ throwCount: drill.throwCount + 1 })}
 className="w-8 h-8 rounded-lg bg-[var(--muted-bg)] flex items-center justify-center text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)] transition-colors font-bold text-lg"
 >
 +
 </button>
 <span className="text-xs text-muted ml-1">throws</span>
 </div>
 </div>

 {/* Notes */}
 <input
 type="text"
 value={drill.notes}
 onChange={(e) => update({ notes: e.target.value })}
 placeholder="Drill notes (optional)"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--foreground)] placeholder-[var(--muted)]"
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
 title="No throws logged yet"
 description="Log your first session to see trends"
 action={<button className="btn-primary" onClick={onLogSession}>Log a Session</button>}
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
 className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)]"
 >
 <option value="">All Events</option>
 {THROW_EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
 </select>
 <select
 value={filterDrill}
 onChange={(e) => setFilterDrill(e.target.value)}
 className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)]"
 >
 <option value="">All Drills</option>
 {DRILL_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
 </select>
 <span className="self-center text-xs text-muted">{sessionCount} sessions total</span>
 </div>

 {/* Best mark trend chart */}
 {filteredTrends.length > 0 && (
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--foreground)]">Best Mark Progression</h3>
 <p className="text-xs text-surface-700 dark:text-surface-300">Best throw per drill type and implement weight over time</p>
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
 <h3 className="text-sm font-bold text-[var(--foreground)]">Session Volume</h3>
 <p className="text-xs text-surface-700 dark:text-surface-300">Total throws logged per session date</p>
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
 <h3 className="text-sm font-bold text-[var(--foreground)]">All-Time Bests</h3>
 <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
 {filteredTrends.map((series) => {
 const best = Math.max(...series.points.map((p) => p.bestMark));
 const totalThrows = series.points.reduce((s, p) => s + p.throwCount, 0);
 return (
 <div key={series.key} className="py-2.5 flex items-center justify-between">
 <div>
 <p className="text-sm font-semibold text-[var(--foreground)]">{drillLabel(series.drillType)}</p>
 <p className="text-xs text-surface-700 dark:text-surface-300">{series.implement} · {series.points.length} sessions · {totalThrows} throws</p>
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
 <p className="text-sm text-muted">No mark data for the selected filters.</p>
 </div>
 )}
 </div>
 );
}

// ── Sessions View ──────────────────────────────────────────────────────

function SessionsView({ athleteId, onEdit, onLogSession }: { athleteId: string | null; onEdit: (sessionId: string) => void; onLogSession: () => void }) {
 const [sessions, setSessions] = useState<Array<{
   id: string;
   event: string;
   date: string;
   notes?: string | null;
   drillLogs: Array<{
     throwCount: number;
     implementWeight?: number | null;
     implementWeightUnit?: string | null;
     implementWeightOriginal?: number | null;
     drillType: string;
     bestMark?: number | null;
   }>;
 }>>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   if (!athleteId) return;
   fetch(`/api/throws/athlete-sessions?athleteId=${athleteId}`)
     .then((r) => r.json())
     .then((d) => { if (d.success) setSessions(d.data); })
     .catch(() => {})
     .finally(() => setLoading(false));
 }, [athleteId]);

 if (loading) return (
   <div className="space-y-3">
     {[1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
   </div>
 );

 if (sessions.length === 0) return (
   <div className="card">
     <EmptyState
       title="No sessions yet"
       description="Log your first throws session to see it here"
       action={<button className="btn-primary" onClick={onLogSession}>Log a Session</button>}
     />
   </div>
 );

 return (
   <div className="space-y-3">
     {sessions.map((session) => {
       const eventMeta = THROW_EVENTS.find((e) => e.value === session.event);
       const totalThrows = session.drillLogs.reduce((s, d) => s + (d.throwCount || 0), 0);
       const drillCount = session.drillLogs.length;
       const topMark = session.drillLogs.reduce((best, d) => {
         const m = d.bestMark ?? 0;
         return m > best ? m : best;
       }, 0);
       const dateStr = new Date(session.date + "T00:00:00").toLocaleDateString("en-US", {
         weekday: "short",
         month: "short",
         day: "numeric",
       });

       return (
         <div key={session.id} className="card !p-4">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3 min-w-0">
               <span
                 className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                 style={{ backgroundColor: eventMeta?.color ?? "#666", opacity: 0.9 }}
               >
                 <span className="text-white">{eventMeta?.icon}</span>
               </span>
               <div className="min-w-0">
                 <p className="text-sm font-bold text-[var(--foreground)] truncate">
                   {eventMeta?.label ?? session.event}
                 </p>
                 <p className="text-xs text-surface-700 dark:text-surface-300">
                   {dateStr}
                 </p>
               </div>
             </div>

             <div className="flex items-center gap-3">
               <div className="text-right">
                 <p className="text-xs text-surface-700 dark:text-surface-300">
                   {drillCount} drill{drillCount !== 1 ? "s" : ""} &middot; {totalThrows} throw{totalThrows !== 1 ? "s" : ""}
                 </p>
                 {topMark > 0 && (
                   <p className="text-sm font-bold font-mono text-orange-600 dark:text-orange-400">
                     {topMark.toFixed(2)}m
                   </p>
                 )}
               </div>

               <button
                 type="button"
                 onClick={() => onEdit(session.id)}
                 className="shrink-0 w-8 h-8 rounded-lg bg-[var(--muted-bg)] hover:bg-[var(--muted-bg)] flex items-center justify-center text-surface-700 dark:text-surface-300 hover:text-primary-600 transition-colors"
                 aria-label="Edit session"
                 title="Edit session"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                 </svg>
               </button>
             </div>
           </div>

           {/* Drill breakdown */}
           {session.drillLogs.length > 0 && (
             <div className="mt-3 pt-3 border-t border-[var(--card-border)] flex flex-wrap gap-2">
               {session.drillLogs.map((d, i) => {
                 const drillMeta = DRILL_TYPES.find((dt) => dt.value === d.drillType);
                 const weightStr = formatImplementWeight(
                   d.implementWeight ?? null,
                   d.implementWeightUnit,
                   d.implementWeightOriginal
                 );
                 return (
                   <span
                     key={i}
                     className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                   >
                     {drillMeta?.short ?? d.drillType} {weightStr !== "\u2014" ? `(${weightStr})` : ""} &times;{d.throwCount}
                   </span>
                 );
               })}
             </div>
           )}
         </div>
       );
     })}
   </div>
 );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ThrowsLogPage() {
 const searchParams = useSearchParams();
 const [tab, setTab] = useState<"log" | "trends" | "sessions">("log");
 const [step, setStep] = useState<1 | 2 | 3>(1);
 const [athleteId, setAthleteId] = useState<string | null>(null);
 const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
 const [editLoaded, setEditLoaded] = useState(false);

 // Past drills for smart suggestions
 const [pastDrills, setPastDrills] = useState<string[]>([]);

 // Fetch own athleteId once on mount
 useEffect(() => {
 fetch("/api/auth/me")
 .then((r) => r.json())
 .then((d) => { if (d.success) setAthleteId(d.data.athleteProfile?.id ?? null); })
 .catch(() => {});
 }, []);

 // Handle ?edit=sessionId from navigation
 useEffect(() => {
   const editId = searchParams.get("edit");
   if (editId && !editLoaded) {
     setEditLoaded(true);
     loadSessionForEdit(editId);
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [searchParams, editLoaded]);

 // Log state
 const [selectedEvent, setSelectedEvent] = useState("");
 const [date, setDate] = useState(localToday());
 const [drills, setDrills] = useState<DrillRow[]>([newDrill()]);
 const [sessionNotes, setSessionNotes] = useState("");
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);

 // Fetch past drills when event changes
 useEffect(() => {
 if (!selectedEvent) { setPastDrills([]); return; }
 fetch(`/api/throws/past-drills?event=${selectedEvent}`)
 .then((r) => r.json())
 .then((d) => { if (d.success) setPastDrills(d.data); })
 .catch(() => {});
 }, [selectedEvent]);

 function resetForm() {
 setStep(1);
 setSelectedEvent("");
 setDate(localToday());
 setDrills([newDrill()]);
 setSessionNotes("");
 setSaved(false);
 setEditingSessionId(null);
 }

 async function loadSessionForEdit(sessionId: string) {
   try {
     const res = await fetch(`/api/throws/athlete-sessions/${sessionId}`);
     const data = await res.json();
     if (!data.success) return;
     const session = data.data;

     setEditingSessionId(sessionId);
     setSelectedEvent(session.event);
     setDate(session.date);
     setSessionNotes(session.notes || "");
     setDrills(
       session.drillLogs.map((d: { drillType: string; implementWeightOriginal?: number | null; implementWeight?: number | null; implementWeightUnit?: string | null; wireLength?: string | null; throwCount?: number; bestMark?: number | null; notes?: string | null }) => ({
         id: crypto.randomUUID(),
         drillType: d.drillType,
         implementWeight: d.implementWeightOriginal
           ? String(d.implementWeightOriginal)
           : d.implementWeight
             ? String(d.implementWeight)
             : "",
         implementUnit: (d.implementWeightUnit || "kg") as "kg" | "lbs",
         wireLength: d.wireLength || "FULL",
         throwCount: d.throwCount || 0,
         bestMark: d.bestMark ? String(d.bestMark) : "",
         notes: d.notes || "",
       }))
     );
     setStep(2);
     setTab("log");
   } catch {
     /* ignore */
   }
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

 // Bondarchuk sequence validation: check if drills are in descending weight order
 const sequenceWarning = (() => {
  const weights = drills
   .map((d) => parseFloat(d.implementWeight))
   .filter((w) => !isNaN(w) && w > 0);
  if (weights.length < 2) return null;
  for (let i = 1; i < weights.length; i++) {
   if (weights[i] > weights[i - 1]) {
    return `Ascending weight detected (${weights[i - 1]}kg \u2192 ${weights[i]}kg). Bondarchuk methodology requires heavy \u2192 light sequencing. Light before heavy can decrease performance by 2\u20134 meters.`;
   }
  }
  return null;
 })();

 async function handleSave() {
 setSaving(true);
 const drillLogs = drills
 .filter((d) => d.throwCount > 0 || d.bestMark)
 .map((d) => {
 const implKg = d.implementUnit === "lbs" && d.implementWeight
 ? parseFloat(d.implementWeight) * LBS_TO_KG
 : parseFloat(d.implementWeight) || null;
 return {
 drillType: d.drillType,
 implementWeight: implKg,
 implementWeightUnit: d.implementUnit,
 implementWeightOriginal: d.implementWeight ? parseFloat(d.implementWeight) : null,
 wireLength: selectedEvent === "HAMMER" ? d.wireLength : null,
 throwCount: d.throwCount,
 bestMark: d.bestMark ? parseFloat(d.bestMark) : null,
 notes: d.notes || null,
 };
 });

 try {
 const url = editingSessionId
   ? `/api/throws/athlete-sessions/${editingSessionId}`
   : "/api/throws/athlete-sessions";
 const method = editingSessionId ? "PUT" : "POST";
 const res = await fetch(url, {
 method,
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ athleteId, event: selectedEvent, date, notes: sessionNotes || null, drillLogs }),
 });
 const data = await res.json();
 if (data.success) setSaved(true);
 } catch { /* ignore */ }
 setSaving(false);
 }

 const eventMeta = THROW_EVENTS.find((e) => e.value === selectedEvent);

 const tabCls = (t: "log" | "trends" | "sessions") =>
 `px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
 tab === t
 ? "bg-orange-500 text-white"
 : "text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)]"
 }`;

 return (
 <div className="animate-spring-up space-y-5 max-w-2xl mx-auto pb-8">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-bold text-[var(--foreground)]">Throws Session</h1>
 <p className="text-sm text-surface-700 dark:text-surface-300">Log drills, marks, and track your progress</p>
 </div>
 <Link href="/athlete/throws" className="text-sm text-primary-600 dark:text-primary-300 hover:underline">
 ← Throws
 </Link>
 </div>

 {/* Tab switcher */}
 <div className="flex gap-1 bg-[var(--muted-bg)] rounded-xl p-1">
 <button onClick={() => setTab("log")} className={tabCls("log")}>
 <svg className="w-4 h-4 hidden sm:inline -mt-0.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Log Session
 </button>
 <button onClick={() => setTab("trends")} className={tabCls("trends")}>
 <svg className="w-4 h-4 hidden sm:inline -mt-0.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
 </svg>
 Trends
 </button>
 <button onClick={() => setTab("sessions")} className={tabCls("sessions")}>
 <svg className="w-4 h-4 hidden sm:inline -mt-0.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
 </svg>
 Sessions
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
 <p className="text-lg font-bold text-[var(--foreground)]">{editingSessionId ? "Session Updated!" : "Session Logged!"}</p>
 <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
 Your {eventMeta?.label} session on {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} has been {editingSessionId ? "updated" : "saved"}.
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
 <p className="text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300 mb-3">
 Select Event
 </p>
 <div className="grid grid-cols-2 gap-2 sm:gap-3">
 {THROW_EVENTS.map((ev) => (
 <button
 key={ev.value}
 type="button"
 onClick={() => setSelectedEvent(ev.value)}
 className={`relative rounded-xl p-3 sm:p-4 text-left transition-all border-2 ${
 selectedEvent === ev.value
 ? "border-transparent shadow-lg scale-[1.02]"
 : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
 }`}
 style={selectedEvent === ev.value ? { backgroundColor: ev.color, borderColor: ev.color } : {}}
 >
 <div className="text-2xl mb-2">{ev.icon}</div>
 <p className={`text-sm font-bold ${selectedEvent === ev.value ? "text-white" : "text-[var(--foreground)]"}`}>
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
 <label className="text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
 Session Date
 </label>
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)]"
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
 <button onClick={() => setStep(1)} className="w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-surface-700 dark:hover:text-surface-300 transition-colors">
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
 <span className="text-xs text-muted">{drills.length} drill{drills.length !== 1 ? "s" : ""}</span>
 </div>

 {/* Drill cards */}
 {drills.map((drill) => (
 <DrillCard
 key={drill.id}
 drill={drill}
 event={selectedEvent}
 pastDrills={pastDrills}
 onChange={(updated) => updateDrill(drill.id, updated)}
 onRemove={() => removeDrill(drill.id)}
 canRemove={drills.length > 1}
 />
 ))}

 {/* Add drill button */}
 <button
 type="button"
 onClick={addDrill}
 className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-border-strong)] text-sm font-semibold text-surface-700 dark:text-surface-300 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Another Drill
 </button>

 {/* Bondarchuk sequence warning */}
 {sequenceWarning && (
 <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
 <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 <div>
 <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Bondarchuk Sequence Warning</p>
 <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{sequenceWarning}</p>
 <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">Reorder your drills heaviest → lightest for optimal transfer.</p>
 </div>
 </div>
 )}

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
 <button onClick={() => setStep(2)} className="text-muted hover:text-surface-700 dark:hover:text-surface-300 transition-colors">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">Review Session</span>
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
 <span className="text-sm text-surface-700 dark:text-surface-300">
 {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
 </span>
 </div>

 <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
 {drills.map((drill) => {
 const meta = DRILL_TYPES.find((d) => d.value === drill.drillType);
 return (
 <div key={drill.id} className="py-2.5 flex items-center justify-between">
 <div>
 <p className="text-sm font-semibold text-[var(--foreground)]">{meta?.label}</p>
 <p className="text-xs text-surface-700 dark:text-surface-300">
 {drill.implementWeight ? `${drill.implementWeight}${drill.implementUnit}` : "No implement"}{selectedEvent === "HAMMER" && drill.wireLength !== "FULL" ? ` (${WIRE_LENGTH_OPTIONS.find((w) => w.value === drill.wireLength)?.label ?? ""} wire)` : ""} · {drill.throwCount} throw{drill.throwCount !== 1 ? "s" : ""}
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

 <div className="pt-1 text-xs text-muted">
 Total: {drills.reduce((s, d) => s + d.throwCount, 0)} throws across {drills.length} drill{drills.length !== 1 ? "s" : ""}
 </div>
 </div>

 {/* Session notes */}
 <div className="space-y-1">
 <label className="text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
 Session Notes (optional)
 </label>
 <textarea
 value={sessionNotes}
 onChange={(e) => setSessionNotes(e.target.value)}
 placeholder="How did it go? Weather, energy, technique cues..."
 rows={3}
 className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] resize-none"
 />
 </div>

 {/* Bondarchuk sequence warning in review */}
 {sequenceWarning && (
 <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
 <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 <p className="text-xs text-amber-700 dark:text-amber-400">{sequenceWarning}</p>
 </div>
 )}

 <button
 onClick={handleSave}
 disabled={saving}
 className="w-full py-3.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-60"
 style={{ backgroundColor: eventMeta?.color }}
 >
 {saving ? "Saving..." : editingSessionId ? "Update Session" : "Save Session"}
 </button>
 </div>
 )}
 </>
 )}
 </>
 )}

 {/* ── TRENDS TAB ────────────────────────────────────────────── */}
 {tab === "trends" && <TrendsView athleteId={athleteId} onLogSession={() => setTab("log")} />}

 {/* ── SESSIONS TAB ──────────────────────────────────────────── */}
 {tab === "sessions" && (
 <SessionsView
   athleteId={athleteId}
   onEdit={loadSessionForEdit}
   onLogSession={() => setTab("log")}
 />
 )}
 </div>
 );
}
