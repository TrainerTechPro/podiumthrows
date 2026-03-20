"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { EVENTS, TRAINING_PHASES, parseEvents, type ThrowEvent, type TrainingPhase } from "@/lib/throws/constants";
import { csrfHeaders } from "@/lib/csrf-client";

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

interface RosterAthlete {
 id: string;
 firstName: string;
 lastName: string;
 events: string[];
}

export default function ThrowsLibraryPage() {
 const [sessions, setSessions] = useState<ThrowsSession[]>([]);
 const [loading, setLoading] = useState(true);
 const [filterEvent, setFilterEvent] = useState<string>("");
 const [filterType, setFilterType] = useState<string>("");
 const [filterPhase, setFilterPhase] = useState<string>("");

 // Assign modal state
 const [assignSessionId, setAssignSessionId] = useState<string | null>(null);
 const [athletes, setAthletes] = useState<RosterAthlete[]>([]);
 const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
 const [assignDate, setAssignDate] = useState(() => new Date().toISOString().split("T")[0]);
 const [assigning, setAssigning] = useState(false);
 const [assignError, setAssignError] = useState("");
 const [assignSuccess, setAssignSuccess] = useState("");

 useEffect(() => {
 fetch("/api/throws/sessions")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setSessions(data.data);
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, []);

 // Fetch athletes when assign modal opens
 useEffect(() => {
 if (!assignSessionId) return;
 fetch("/api/athletes")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) {
  setAthletes(data.data.map((a: { id: string; user: { firstName: string; lastName: string } }) => ({
   id: a.id,
   firstName: a.user.firstName,
   lastName: a.user.lastName,
   events: [],
  })));
 }
 })
 .catch(() => {});
 }, [assignSessionId]);

 function openAssignModal(sessionId: string) {
 setAssignSessionId(sessionId);
 setSelectedAthletes(new Set());
 setAssignDate(new Date().toISOString().split("T")[0]);
 setAssignError("");
 setAssignSuccess("");
 }

 function toggleAthlete(id: string) {
 setSelectedAthletes((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }

 function selectAllAthletes() {
 if (selectedAthletes.size === athletes.length) {
 setSelectedAthletes(new Set());
 } else {
 setSelectedAthletes(new Set(athletes.map((a) => a.id)));
 }
 }

 async function handleAssign() {
 if (selectedAthletes.size === 0 || !assignSessionId) return;
 setAssigning(true);
 setAssignError("");
 setAssignSuccess("");
 try {
 const res = await fetch("/api/throws/assignments", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...csrfHeaders() },
  body: JSON.stringify({
   sessionId: assignSessionId,
   athleteIds: [...selectedAthletes],
   assignedDate: assignDate,
  }),
 });
 const data = await res.json();
 if (data.success) {
  setAssignSuccess(`Assigned to ${data.data.count} athlete${data.data.count !== 1 ? "s" : ""}`);
  // Refresh sessions to update assignment count
  const sessRes = await fetch("/api/throws/sessions");
  const sessData = await sessRes.json();
  if (sessData.success) setSessions(sessData.data);
  setTimeout(() => setAssignSessionId(null), 1500);
 } else {
  setAssignError(data.error ?? "Failed to assign");
 }
 } catch {
 setAssignError("Network error. Please try again.");
 } finally {
 setAssigning(false);
 }
 }

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
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">Session Library</h1>
 <p className="text-sm text-surface-700 dark:text-surface-300">{sessions.length} saved sessions</p>
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
 <p className="text-muted">
 {sessions.length === 0 ? "No sessions created yet." : "No sessions match your filters."}
 </p>
 </div>
 ) : (
 <StaggeredList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map((session) => {
 const sessionEvents = parseEvents(session.event);
 const throwBlocks = session.blocks.filter((b) => b.blockType === "THROWING");
 const totalThrows = throwBlocks.reduce((sum, b) => {
 try { return sum + (JSON.parse(b.config)?.throwCount || 0); } catch { return sum; }
 }, 0);

 return (
 <div key={session.id} className="card !p-4 space-y-3 hover:shadow-md transition-shadow">
 <div>
 <h3 className="font-semibold text-[var(--foreground)]">{session.name}</h3>
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
 <span className="text-xs text-muted">
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
 <div className="flex items-center gap-4 text-xs text-surface-700 dark:text-surface-300">
 <span>{session.blocks.length} blocks</span>
 {totalThrows > 0 && <span>{totalThrows} throws</span>}
 {session.estimatedDuration && <span>~{session.estimatedDuration} min</span>}
 <span>{session.assignments.length}x assigned</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted">
 Created {new Date(session.createdAt).toLocaleDateString()}
 </span>
 <button
 onClick={() => openAssignModal(session.id)}
 className="px-3 py-1 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
 >
 Assign
 </button>
 </div>
 </div>
 );
 })}
 </StaggeredList>
 )}

 {/* Assign Modal */}
 {assignSessionId && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssignSessionId(null)}>
 <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
 <div className="p-5 border-b border-[var(--card-border)]">
  <h2 className="text-lg font-bold text-[var(--foreground)]">Assign Session</h2>
  <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
  {sessions.find((s) => s.id === assignSessionId)?.name}
  </p>
 </div>

 <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "50vh" }}>
  {/* Date picker */}
  <div>
  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Date</label>
  <input
   type="date"
   value={assignDate}
   onChange={(e) => setAssignDate(e.target.value)}
   className="input w-full"
  />
  </div>

  {/* Athlete list */}
  <div>
  <div className="flex items-center justify-between mb-2">
   <label className="text-sm font-medium text-[var(--foreground)]">Athletes</label>
   <button
   onClick={selectAllAthletes}
   className="text-xs text-primary-500 hover:text-primary-600 transition-colors"
   >
   {selectedAthletes.size === athletes.length ? "Deselect all" : "Select all"}
   </button>
  </div>
  {athletes.length === 0 ? (
   <p className="text-sm text-muted text-center py-4">No athletes on roster</p>
  ) : (
   <div className="space-y-1">
   {athletes.map((a) => (
    <label
    key={a.id}
    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
     selectedAthletes.has(a.id)
     ? "bg-primary-500/10"
     : "hover:bg-[var(--muted-bg)]"
    }`}
    >
    <input
     type="checkbox"
     checked={selectedAthletes.has(a.id)}
     onChange={() => toggleAthlete(a.id)}
     className="w-4 h-4 accent-primary-500 rounded"
    />
    <span className="text-sm text-[var(--foreground)]">
     {a.firstName} {a.lastName}
    </span>
    </label>
   ))}
   </div>
  )}
  </div>
 </div>

 <div className="p-5 border-t border-[var(--card-border)] space-y-3">
  {assignError && (
  <p className="text-sm text-red-600 dark:text-red-400">{assignError}</p>
  )}
  {assignSuccess && (
  <p className="text-sm text-green-600 dark:text-green-400">{assignSuccess}</p>
  )}
  <div className="flex gap-3">
  <button
   onClick={handleAssign}
   disabled={assigning || selectedAthletes.size === 0 || !!assignSuccess}
   className="btn-primary flex-1"
  >
   {assigning ? "Assigning..." : `Assign to ${selectedAthletes.size} athlete${selectedAthletes.size !== 1 ? "s" : ""}`}
  </button>
  <button
   onClick={() => setAssignSessionId(null)}
   className="px-4 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-300 hover:bg-[var(--muted-bg)] transition-colors"
  >
   Cancel
  </button>
  </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
