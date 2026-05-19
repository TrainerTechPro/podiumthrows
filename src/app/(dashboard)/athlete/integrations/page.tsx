import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { StaggeredList } from "@/components";
import { WhoopCard } from "../settings/_whoop-card";
import { OuraCard } from "../settings/_oura-card";
import { getWearableHealth } from "@/lib/data/wearable-health";
import { logger } from "@/lib/logger";

export default async function AthleteIntegrationsPage() {
  const session = await getSession();
  if (!session || (session.role !== "ATHLETE" && session.role !== "COACH")) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  // Sync-mode lives outside the health summary because the cards still
  // need to display + edit it. One round-trip each — small, parallelizable.
  let whoopSyncMode: string | undefined;
  let ouraSyncMode: string | undefined;
  try {
    const row = await prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { syncMode: true },
    });
    whoopSyncMode = row?.syncMode;
  } catch (err) {
    logger.debug("whoopConnection syncMode lookup failed", {
      context: "src/app/(dashboard)/athlete/integrations/page.tsx",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
  try {
    const row = await prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { syncMode: true },
    });
    ouraSyncMode = row?.syncMode;
  } catch (err) {
    logger.debug("ouraConnection syncMode lookup failed", {
      context: "src/app/(dashboard)/athlete/integrations/page.tsx",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }

  const health = await getWearableHealth(athlete.id);
  const connectedCount = (health.whoop ? 1 : 0) + (health.oura ? 1 : 0);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Integrations</h1>
        <p className="text-sm text-muted mt-0.5">
          Connect your wearables to sync recovery, sleep, and readiness data.
          {connectedCount > 0 && (
            <span className="ml-1 text-primary-500 font-medium">{connectedCount} connected</span>
          )}
        </p>
      </div>

      {/* Wearable Cards */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Wearables</h2>
        <StaggeredList className="space-y-4" staggerDelay={80}>
          <div>
            <WhoopCard
              connected={!!health.whoop}
              syncMode={whoopSyncMode}
              lastSyncAt={health.whoop?.lastSyncAt ?? null}
              needsReauth={health.whoop?.needsReauth ?? false}
              lastSyncError={health.whoop?.lastSyncError ?? null}
              lastSyncErrorAt={health.whoop?.lastSyncErrorAt ?? null}
            />
          </div>
          <div>
            <OuraCard
              connected={!!health.oura}
              syncMode={ouraSyncMode}
              lastSyncAt={health.oura?.lastSyncAt ?? null}
              needsReauth={health.oura?.needsReauth ?? false}
              lastSyncError={health.oura?.lastSyncError ?? null}
              lastSyncErrorAt={health.oura?.lastSyncErrorAt ?? null}
            />
          </div>
        </StaggeredList>
      </section>
    </div>
  );
}
