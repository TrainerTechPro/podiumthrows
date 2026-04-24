import { redirect } from "next/navigation";
import { Activity, Heart } from "lucide-react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { needsReauth } from "@/lib/wearable-auth";
import { StaggeredList } from "@/components";
import { WhoopCard } from "../settings/_whoop-card";
import { OuraCard } from "../settings/_oura-card";
import { logger } from "@/lib/logger";

export default async function AthleteIntegrationsPage() {
  const session = await getSession();
  if (!session || (session.role !== "ATHLETE" && session.role !== "COACH")) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  let whoopConnection: {
    syncMode: string;
    lastSyncAt: Date | null;
    refreshToken: string;
    scopes: string;
  } | null = null;
  try {
    whoopConnection = await prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { syncMode: true, lastSyncAt: true, refreshToken: true, scopes: true },
    });
  } catch (err) {
    // Table may not exist yet
    logger.debug("Table may not exist yet", {
      context: "src/app/(dashboard)/athlete/integrations/page.tsx",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }

  // Detect unhealthy connections using shared utility
  const whoopNeedsReauth = whoopConnection
    ? needsReauth(whoopConnection.refreshToken, whoopConnection.scopes, "offline")
    : false;

  let ouraConnection: {
    syncMode: string;
    lastSyncAt: Date | null;
    refreshToken: string;
    scopes: string;
  } | null = null;
  try {
    ouraConnection = await prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { syncMode: true, lastSyncAt: true, refreshToken: true, scopes: true },
    });
  } catch (err) {
    // Table may not exist yet
    logger.debug("Table may not exist yet", {
      context: "src/app/(dashboard)/athlete/integrations/page.tsx",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }

  // Oura doesn't use a separate "offline" scope — refresh tokens are always granted.
  // Check for empty refresh token only.
  const ouraNeedsReauth = ouraConnection
    ? needsReauth(ouraConnection.refreshToken, ouraConnection.scopes, "")
    : false;

  const connectedCount = (whoopConnection ? 1 : 0) + (ouraConnection ? 1 : 0);

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
              connected={!!whoopConnection}
              syncMode={whoopConnection?.syncMode}
              lastSyncAt={whoopConnection?.lastSyncAt?.toISOString() ?? null}
              needsReauth={whoopNeedsReauth}
            />
          </div>
          <div>
            <OuraCard
              connected={!!ouraConnection}
              syncMode={ouraConnection?.syncMode}
              lastSyncAt={ouraConnection?.lastSyncAt?.toISOString() ?? null}
              needsReauth={ouraNeedsReauth}
            />
          </div>
        </StaggeredList>
      </section>

      {/* Coming Soon — specific devices */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Coming Soon</h2>
        <StaggeredList className="grid grid-cols-2 gap-3" staggerDelay={60}>
          {[
            { name: "Garmin", icon: Activity, desc: "Running & GPS data" },
            { name: "Apple Health", icon: Heart, desc: "Unified health metrics" },
          ].map((device) => (
            <div key={device.name} className="card p-4 opacity-50 cursor-default select-none">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--muted-bg)] flex items-center justify-center">
                  <device.icon
                    size={18}
                    strokeWidth={1.75}
                    className="text-muted"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{device.name}</p>
                  <p className="text-xs text-muted">{device.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </StaggeredList>
      </section>
    </div>
  );
}
