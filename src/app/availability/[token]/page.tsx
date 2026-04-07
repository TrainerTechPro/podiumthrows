import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { PrintButton } from "./_print-button";

// ─── Types ────────────────────────────────────────────────────────────────────

const DAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getNext14Days(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const profile = await prisma.athleteProfile.findUnique({
    where: { availabilityShareToken: token },
    select: { firstName: true },
  });
  if (!profile) return { title: "Availability — Podium Throws" };
  return {
    title: `${profile.firstName}'s Availability — Podium Throws`,
    robots: { index: false, follow: false },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicAvailabilityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const today = new Date().toISOString().slice(0, 10);
  const in14Days = getNext14Days().at(-1)!;

  const profile = await prisma.athleteProfile.findUnique({
    where: { availabilityShareToken: token },
    select: {
      firstName: true,
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      availabilityOverrides: {
        where: { date: { gte: today, lte: in14Days } },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!profile) notFound();

  // Group recurring blocks by day
  const blocksByDay = new Map<number, typeof profile.availability>();
  for (let i = 0; i < 7; i++) blocksByDay.set(i, []);
  for (const block of profile.availability) {
    blocksByDay.get(block.dayOfWeek)?.push(block);
  }

  const hasAnyBlocks = profile.availability.length > 0;

  return (
    <>
      {/* Minimal print-optimised page — no auth required */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { border: 1px solid #ccc !important; page-break-inside: avoid; }
          .print-header { border-bottom: 2px solid #000 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-[#0a0a0c] text-white font-sans">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Header */}
          <div className="print-header pb-4 border-b border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">
                  Podium Throws
                </p>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-chakra-petch, sans-serif)" }}>
                  {profile.firstName}&apos;s Availability
                </h1>
                <p className="text-sm text-white/50 mt-0.5">
                  Read-only schedule — updated in real time
                </p>
              </div>
              <PrintButton />
            </div>
          </div>

          {/* Weekly Schedule */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Weekly Schedule
            </h2>

            {!hasAnyBlocks && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center">
                <p className="text-sm text-white/40">No recurring availability set yet.</p>
              </div>
            )}

            {hasAnyBlocks && (
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                {DAY_LABELS_FULL.map((day, dayIndex) => {
                  const dayBlocks = blocksByDay.get(dayIndex) ?? [];
                  const availBlocks = dayBlocks.filter((b) => b.type === "AVAILABLE");
                  const unavailBlocks = dayBlocks.filter((b) => b.type !== "AVAILABLE");

                  return (
                    <div
                      key={day}
                      className="print-card flex gap-3 px-4 py-3 border-b border-white/8 last:border-0"
                    >
                      <div className="w-9 flex-shrink-0 pt-0.5">
                        <span className="text-xs font-semibold text-white/40">
                          {DAY_LABELS_SHORT[dayIndex]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {dayBlocks.length === 0 ? (
                          <span className="text-sm text-white/25">—</span>
                        ) : (
                          <div className="space-y-1">
                            {availBlocks.map((b) => (
                              <div key={b.id} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                <span className="text-sm text-white/80 font-mono tabular-nums">
                                  {formatTime(b.startTime)} – {formatTime(b.endTime)}
                                </span>
                                {b.label && (
                                  <span className="text-xs text-white/40">{b.label}</span>
                                )}
                              </div>
                            ))}
                            {unavailBlocks.map((b) => (
                              <div key={b.id} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                <span className="text-sm text-white/50 font-mono tabular-nums line-through">
                                  {formatTime(b.startTime)} – {formatTime(b.endTime)}
                                </span>
                                {b.label && (
                                  <span className="text-xs text-white/30">{b.label}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming Changes (next 14 days) */}
          {profile.availabilityOverrides.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Upcoming Changes (next 14 days)
              </h2>
              <div className="space-y-2">
                {profile.availabilityOverrides.map((o) => (
                  <div
                    key={o.id}
                    className={`print-card flex items-start gap-3 rounded-xl border px-4 py-3 ${
                      o.type === "AVAILABLE"
                        ? "border-green-500/30 bg-green-500/8"
                        : "border-red-500/30 bg-red-500/8"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                        o.type === "AVAILABLE" ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white/90">
                          {formatDate(o.date)}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            o.type === "AVAILABLE"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {o.type === "AVAILABLE" ? "Available" : "Unavailable"}
                        </span>
                      </div>
                      {o.startTime && o.endTime ? (
                        <p className="text-xs font-mono tabular-nums text-white/50 mt-0.5">
                          {formatTime(o.startTime)} – {formatTime(o.endTime)}
                        </p>
                      ) : (
                        <p className="text-xs text-white/40 mt-0.5">All day</p>
                      )}
                      {o.reason && (
                        <p className="text-xs text-white/40 mt-1 italic">{o.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="no-print border-t border-white/8 pt-4 text-center">
            <p className="text-xs text-white/25">
              This is a read-only view. Data updates automatically.
            </p>
          </footer>

        </div>
      </div>
    </>
  );
}
