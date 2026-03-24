import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { WhoopCard } from "../settings/_whoop-card";
import { OuraCard } from "../settings/_oura-card";

export default async function AthleteIntegrationsPage() {
  const session = await getSession();
  if (!session || (session.role !== "ATHLETE" && session.role !== "COACH")) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  let whoopConnection: { syncMode: string; lastSyncAt: Date | null } | null = null;
  try {
    whoopConnection = await prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { syncMode: true, lastSyncAt: true },
    });
  } catch {
    // Table may not exist yet
  }

  let ouraConnection: { syncMode: string; lastSyncAt: Date | null } | null = null;
  try {
    ouraConnection = await prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { syncMode: true, lastSyncAt: true },
    });
  } catch {
    // Table may not exist yet
  }

  const connectedCount = (whoopConnection ? 1 : 0) + (ouraConnection ? 1 : 0);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Integrations</h1>
        <p className="text-sm text-muted mt-0.5">
          Connect your wearables to sync recovery, sleep, and readiness data.
          {connectedCount > 0 && (
            <span className="ml-1 text-primary-500 font-medium">
              {connectedCount} connected
            </span>
          )}
        </p>
      </div>

      {/* Wearable Cards */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Wearables</h2>
        <WhoopCard
          connected={!!whoopConnection}
          syncMode={whoopConnection?.syncMode}
          lastSyncAt={whoopConnection?.lastSyncAt?.toISOString() ?? null}
        />
        <OuraCard
          connected={!!ouraConnection}
          syncMode={ouraConnection?.syncMode}
          lastSyncAt={ouraConnection?.lastSyncAt?.toISOString() ?? null}
        />
      </section>

      {/* Future integrations placeholder */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Coming Soon</h2>
        <div className="card p-5 text-center">
          <p className="text-sm text-muted">
            Garmin, Apple Health, and more integrations are on the way.
          </p>
        </div>
      </section>
    </div>
  );
}
