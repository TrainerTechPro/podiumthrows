import Link from "next/link";
import { Watch, Circle, Zap } from "lucide-react";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { Avatar, Badge } from "@/components";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export default async function CoachIntegrationsPage() {
  const { coach } = await requireCoachSession();

  // Get all athletes with their wearable connections
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      whoopConnection: { select: { syncMode: true, lastSyncAt: true } },
      ouraConnection: { select: { syncMode: true, lastSyncAt: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const athletesWithDevices = athletes.filter(
    (a) => a.whoopConnection || a.ouraConnection
  );
  const athletesWithoutDevices = athletes.filter(
    (a) => !a.whoopConnection && !a.ouraConnection
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Integrations</h1>
        <p className="text-sm text-muted mt-0.5">
          Wearable connections across your roster.
          {athletesWithDevices.length > 0 && (
            <span className="ml-1 text-primary-500 font-medium">
              {athletesWithDevices.length} of {athletes.length} athletes connected
            </span>
          )}
        </p>
      </div>

      {/* Connected athletes */}
      {athletesWithDevices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Connected Athletes
          </h2>
          <div className="space-y-2">
            {athletesWithDevices.map((a) => (
              <Link
                key={a.id}
                href={`/coach/athletes/${a.id}`}
                className="card card-interactive p-4 flex items-center gap-4"
              >
                <Avatar
                  name={`${a.firstName} ${a.lastName}`}
                  src={a.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {a.firstName} {a.lastName}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {a.whoopConnection && (
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Watch size={12} strokeWidth={1.75} aria-hidden="true" />
                        WHOOP
                        {a.whoopConnection.lastSyncAt && (
                          <span className="text-surface-400">
                            · {relativeTime(a.whoopConnection.lastSyncAt)}
                          </span>
                        )}
                      </span>
                    )}
                    {a.ouraConnection && (
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Circle size={12} strokeWidth={1.75} aria-hidden="true" />
                        Oura
                        {a.ouraConnection.lastSyncAt && (
                          <span className="text-surface-400">
                            · {relativeTime(a.ouraConnection.lastSyncAt)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {a.whoopConnection && (
                    <Badge variant="success">WHOOP</Badge>
                  )}
                  {a.ouraConnection && (
                    <Badge variant="success">Oura</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Not connected */}
      {athletesWithoutDevices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            No Device Connected
          </h2>
          <div className="space-y-2">
            {athletesWithoutDevices.map((a) => (
              <div
                key={a.id}
                className="card p-4 flex items-center gap-4 opacity-60"
              >
                <Avatar
                  name={`${a.firstName} ${a.lastName}`}
                  src={a.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="text-xs text-muted">No wearable connected</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {athletes.length === 0 && (
        <div className="card p-8 text-center space-y-2">
          <Zap size={24} strokeWidth={1.75} className="mx-auto text-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--foreground)]">No athletes yet</p>
          <p className="text-xs text-muted">
            Athletes can connect WHOOP, Oura Ring, and other wearables from their Settings page.
          </p>
        </div>
      )}
    </div>
  );
}
