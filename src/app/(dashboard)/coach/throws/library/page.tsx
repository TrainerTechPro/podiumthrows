"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EVENTS, TRAINING_PHASES, parseEvents, type ThrowEvent, type TrainingPhase } from "@/lib/throws/constants";

const PHASE_COLORS: Record<TrainingPhase, string> = {
 ACCUMULATION: "#6A9FD8",
 TRANSMUTATION: "#5BB88A",
 REALIZATION: "#D4915A",
 COMPETITION: "#D46A6A",
};

interface ThrowsSession {
 id: string;
 name: string;
 event: string;
 sessionType: string;
 targetPhase: string | null;
 estimatedDuration: number | null;
 createdAt: string;
 blocks: { id: string; blockType: string; config: string }[];
 assignments: { id: string; status: string }[];
}

export default function ThrowsLibraryPage() {
 const [sessions, setSessions] = useState<ThrowsSession[]>([]);
 const [loading, setLoading] = useState(true);
 const [filterEvent, setFilterEvent] = useState<string>("");
 const [filterType, setFilterType] = useState<string>("");
 const [filterPhase, setFilterPhase] = useState<string>("");

 useEffect(() => {
 fetch("/api/throws/sessions")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setSessions(data.data);
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, []);

 const filtered = sessions.filter((s) => {
 if (filterEvent && !parseEvents(s.event).includes(filterEvent as ThrowEvent)) return false;
 if (filterType && s.sessionType !== filterType) return false;
 if (filterPhase && s.targetPhase !== filterPhase) return false;
 return true;
 });

 if (loading) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="skeleton h-8 w-48" />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
 </div>
 </div>
 );
 }

 return (
 <div className="animate-spring-up space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Session Library</h1>
 <p className="text-sm text-[var(--color-text-2)]">{sessions.length} saved sessions</p>
 </div>
 <Link href="/coach/throws/builder" className="btn-primary">New Session</Link>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap gap-2">
 <select className="input w-auto" value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
 <option value="">All Events</option>
 {(Object.keys(EVENTS) as ThrowEvent[]).map((ev) => (
 <option key={ev} value={ev}>{EVENTS[ev].label}</option>
 ))}
 </select>
 <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
 <option value="">All Types</option>
 <option value="THROWS_ONLY">Throws Only</option>
 <option value="THROWS_LIFT">Throws + Lift</option>
 <option value="LIFT_ONLY">Lift Only</option>
 <option value="COMPETITION_SIM">Competition Sim</option>
 </select>
 <select className="input w-auto" value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)}>
 <option value="">All Phases</option>
 {TRAINING_PHASES.map((ph) => (
 <option key={ph.value} value={ph.value}>{ph.label}</option>
 ))}
 </select>
 </div>

 {filtered.length === 0 ? (
 <div className="card text-center py-12">
 <p className="text-[var(--color-text-3)]">
 {sessions.length === 0 ? "No sessions created yet." : "No sessions match your filters."}
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map((session) => {
 const sessionEvents = parseEvents(session.event);
 const throwBlocks = session.blocks.filter((b) => b.blockType === "THROWING");
 const totalThrows = throwBlocks.reduce((sum, b) => {
 try { return sum + (JSON.parse(b.config)?.throwCount || 0); } catch { return sum; }
 }, 0);

 return (
 <div key={session.id} className="card !p-4 space-y-3 hover:shadow-md transition-shadow">
 <div>
 <h3 className="font-semibold text-[var(--color-text)]">{session.name}</h3>
 <div className="flex items-center gap-2 mt-1.5 flex-wrap">
 {sessionEvents.map((ev) => {
 const meta = EVENTS[ev];
 return (
 <span
 key={ev}
 className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
 style={{ backgroundColor: meta?.color || "#666" }}
 >
 {meta?.label || ev}
 </span>
 );
 })}
 <span className="text-xs text-[var(--color-text-3)]">
 {session.sessionType.replace(/_/g, " ")}
 </span>
 {session.targetPhase && (
 <span
 className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
 style={{
 color: PHASE_COLORS[session.targetPhase as TrainingPhase] || "#666",
 backgroundColor: `${PHASE_COLORS[session.targetPhase as TrainingPhase] || "#666"}15`,
 }}
 >
 {session.targetPhase.slice(0, 3)}
 </span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-4 text-xs text-[var(--color-text-2)]">
 <span>{session.blocks.length} blocks</span>
 {totalThrows > 0 && <span>{totalThrows} throws</span>}
 {session.estimatedDuration && <span>~{session.estimatedDuration} min</span>}
 <span>{session.assignments.length}x assigned</span>
 </div>
 <div className="text-xs text-[var(--color-text-3)]">
 Created {new Date(session.createdAt).toLocaleDateString()}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
