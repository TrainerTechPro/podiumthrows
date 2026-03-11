"use client";

import { useState } from "react";
import { localToday } from "@/lib/utils";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface CoachPR {
  id: string;
  event: string;
  implement: string;
  distance: number;
  achievedAt: string;
  drillType: string | null;
}

interface TestingRecord {
  id: string;
  testDate: string;
  event: string | null;
  competitionMark: number | null;
  heavyImplMark: number | null;
  heavyImplKg: number | null;
  lightImplMark: number | null;
  lightImplKg: number | null;
  squatKg: number | null;
  benchKg: number | null;
  snatchKg: number | null;
  cleanKg: number | null;
  ohpKg: number | null;
  rdlKg: number | null;
  bodyWeightKg: number | null;
  notes: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

/* ─── Records Tab ──────────────────────────────────────────────────────────── */

export function RecordsTab({
  prs: initialPRs,
  testingRecords: initialRecords,
}: {
  prs: CoachPR[];
  testingRecords: TestingRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Group PRs by event
  const prsByEvent = initialPRs.reduce<Record<string, CoachPR[]>>((acc, pr) => {
    (acc[pr.event] ??= []).push(pr);
    return acc;
  }, {});

  async function handleAddRecord(formData: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/coach/my-training/testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        setRecords((prev) => [data.data, ...prev]);
        setShowForm(false);
      }
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm("Delete this testing record?")) return;
    try {
      const res = await fetch(`/api/coach/my-training/testing/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      alert("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      {/* PR Board */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
          Personal Records
        </h3>

        {initialPRs.length === 0 ? (
          <p className="text-sm text-muted">No PRs recorded yet. Log sessions with best marks to track PRs.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(prsByEvent).map(([event, eventPRs]) => (
              <div key={event}>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  {EVENT_LABELS[event] ?? event}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--card-border)]">
                        <th className="text-left py-1.5 text-muted font-semibold">Implement</th>
                        <th className="text-right py-1.5 text-muted font-semibold">Distance</th>
                        <th className="text-right py-1.5 text-muted font-semibold">Date</th>
                        <th className="text-right py-1.5 text-muted font-semibold">Drill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventPRs
                        .sort((a, b) => parseFloat(b.implement) - parseFloat(a.implement))
                        .map((pr) => (
                          <tr key={pr.id} className="border-b border-[var(--card-border)] last:border-0">
                            <td className="py-1.5 text-[var(--foreground)] font-semibold tabular-nums">{pr.implement}</td>
                            <td className="py-1.5 text-right tabular-nums font-semibold text-primary-600 dark:text-primary-400">
                              {pr.distance.toFixed(2)}m
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-muted">
                              {new Date(pr.achievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="py-1.5 text-right text-muted">{pr.drillType ?? "--"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Testing Records */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Testing Records
          </h3>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            {showForm ? "Cancel" : "+ Add Test"}
          </button>
        </div>

        {showForm && (
          <TestingForm onSave={handleAddRecord} saving={saving} />
        )}

        {records.length === 0 && !showForm ? (
          <p className="text-sm text-muted">No testing records yet.</p>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <TestingRecordCard
                key={record.id}
                record={record}
                onDelete={() => handleDeleteRecord(record.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Testing Form ─────────────────────────────────────────────────────────── */

function TestingForm({
  onSave,
  saving,
}: {
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    testDate: localToday(),
    event: "",
    competitionMark: "",
    heavyImplMark: "",
    heavyImplKg: "",
    lightImplMark: "",
    lightImplKg: "",
    squatKg: "",
    benchKg: "",
    snatchKg: "",
    cleanKg: "",
    ohpKg: "",
    rdlKg: "",
    bodyWeightKg: "",
    notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { testDate: form.testDate };
    if (form.event) data.event = form.event;
    if (form.notes) data.notes = form.notes;

    // Convert numeric fields
    const numericFields = [
      "competitionMark", "heavyImplMark", "heavyImplKg", "lightImplMark", "lightImplKg",
      "squatKg", "benchKg", "snatchKg", "cleanKg", "ohpKg", "rdlKg", "bodyWeightKg",
    ] as const;
    for (const f of numericFields) {
      if (form[f]) data[f] = parseFloat(form[f]);
    }

    onSave(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-900/40">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Test Date</label>
          <input
            type="date"
            value={form.testDate}
            onChange={(e) => setForm({ ...form, testDate: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Event</label>
          <select
            value={form.event}
            onChange={(e) => setForm({ ...form, event: e.target.value })}
            className="input"
          >
            <option value="">Select...</option>
            <option value="SHOT_PUT">Shot Put</option>
            <option value="DISCUS">Discus</option>
            <option value="HAMMER">Hammer</option>
            <option value="JAVELIN">Javelin</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Comp Mark (m)</label>
          <input type="number" step="0.01" value={form.competitionMark} onChange={(e) => setForm({ ...form, competitionMark: e.target.value })} className="input" placeholder="18.50" />
        </div>
        <div>
          <label className="label">Heavy Mark (m)</label>
          <input type="number" step="0.01" value={form.heavyImplMark} onChange={(e) => setForm({ ...form, heavyImplMark: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Heavy (kg)</label>
          <input type="number" step="0.01" value={form.heavyImplKg} onChange={(e) => setForm({ ...form, heavyImplKg: e.target.value })} className="input" placeholder="9.0" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Light Mark (m)</label>
          <input type="number" step="0.01" value={form.lightImplMark} onChange={(e) => setForm({ ...form, lightImplMark: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Light (kg)</label>
          <input type="number" step="0.01" value={form.lightImplKg} onChange={(e) => setForm({ ...form, lightImplKg: e.target.value })} className="input" placeholder="6.0" />
        </div>
        <div>
          <label className="label">Body Weight (kg)</label>
          <input type="number" step="0.1" value={form.bodyWeightKg} onChange={(e) => setForm({ ...form, bodyWeightKg: e.target.value })} className="input" />
        </div>
      </div>

      <p className="text-xs font-semibold text-muted uppercase tracking-wider">Strength Tests</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Squat (kg)</label>
          <input type="number" step="0.5" value={form.squatKg} onChange={(e) => setForm({ ...form, squatKg: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Bench (kg)</label>
          <input type="number" step="0.5" value={form.benchKg} onChange={(e) => setForm({ ...form, benchKg: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Snatch (kg)</label>
          <input type="number" step="0.5" value={form.snatchKg} onChange={(e) => setForm({ ...form, snatchKg: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Clean (kg)</label>
          <input type="number" step="0.5" value={form.cleanKg} onChange={(e) => setForm({ ...form, cleanKg: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">OHP (kg)</label>
          <input type="number" step="0.5" value={form.ohpKg} onChange={(e) => setForm({ ...form, ohpKg: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">RDL (kg)</label>
          <input type="number" step="0.5" value={form.rdlKg} onChange={(e) => setForm({ ...form, rdlKg: e.target.value })} className="input" />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input min-h-[48px] resize-y"
          placeholder="Testing conditions, notes..."
        />
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "Saving..." : "Save Testing Record"}
      </button>
    </form>
  );
}

/* ─── Testing Record Card ──────────────────────────────────────────────────── */

function TestingRecordCard({
  record,
  onDelete,
}: {
  record: TestingRecord;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const strengthFields = [
    { label: "Squat", value: record.squatKg },
    { label: "Bench", value: record.benchKg },
    { label: "Snatch", value: record.snatchKg },
    { label: "Clean", value: record.cleanKg },
    { label: "OHP", value: record.ohpKg },
    { label: "RDL", value: record.rdlKg },
  ].filter((f) => f.value != null);

  return (
    <div className="border border-[var(--card-border)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface-50/60 dark:hover:bg-surface-900/20 transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {new Date(record.testDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {record.event && <span className="text-muted font-normal ml-2">{EVENT_LABELS[record.event] ?? record.event}</span>}
          </p>
          <div className="flex gap-3 mt-0.5 text-xs text-muted">
            {record.competitionMark && <span>Comp: {record.competitionMark.toFixed(2)}m</span>}
            {record.bodyWeightKg && <span>BW: {record.bodyWeightKg}kg</span>}
            {strengthFields.length > 0 && <span>{strengthFields.length} strength test{strengthFields.length !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-muted shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-4">
            {record.competitionMark && (
              <div>
                <span className="text-muted uppercase tracking-wider">Competition</span>
                <p className="font-semibold text-[var(--foreground)] tabular-nums">{record.competitionMark.toFixed(2)}m</p>
              </div>
            )}
            {record.heavyImplMark && (
              <div>
                <span className="text-muted uppercase tracking-wider">Heavy ({record.heavyImplKg ?? "?"}kg)</span>
                <p className="font-semibold text-[var(--foreground)] tabular-nums">{record.heavyImplMark.toFixed(2)}m</p>
              </div>
            )}
            {record.lightImplMark && (
              <div>
                <span className="text-muted uppercase tracking-wider">Light ({record.lightImplKg ?? "?"}kg)</span>
                <p className="font-semibold text-[var(--foreground)] tabular-nums">{record.lightImplMark.toFixed(2)}m</p>
              </div>
            )}
          </div>

          {strengthFields.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {strengthFields.map((f) => (
                <div key={f.label}>
                  <span className="text-muted uppercase tracking-wider">{f.label}</span>
                  <p className="font-semibold text-[var(--foreground)] tabular-nums">{f.value}kg</p>
                </div>
              ))}
            </div>
          )}

          {record.notes && (
            <p><span className="text-muted">Notes:</span> <span className="text-[var(--foreground)]">{record.notes}</span></p>
          )}

          <button onClick={onDelete} className="text-xs text-muted hover:text-danger-500 transition-colors">
            Delete record
          </button>
        </div>
      )}
    </div>
  );
}
