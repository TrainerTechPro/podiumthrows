"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { User, Trophy, Scale, Dumbbell, Target, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProfileData,
  ThrowsPRRecord,
  ThrowsInjuryRecord,
  ThrowsProfileSummary,
} from "./_types";
import { TabCore } from "./_tab-core";
import { TabCompetition } from "./_tab-competition";
import { TabImplements } from "./_tab-implements";
import { TabStrength } from "./_tab-strength";
import { TabTechnical } from "./_tab-technical";
import { TabInjury } from "./_tab-injury";

/* ─── Tab definitions ────────────────────────────────────────────────── */

const TABS = [
  { id: "core", label: "Core", icon: User },
  { id: "comp", label: "Comp", icon: Trophy },
  { id: "impl", label: "Impl", icon: Scale },
  { id: "strength", label: "Strength", icon: Dumbbell },
  { id: "tech", label: "Tech", icon: Target },
  { id: "injury", label: "Injury", icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ─── Component ──────────────────────────────────────────────────────── */

interface ProfileTabsProps {
  profile: ProfileData;
  throwsPRs: ThrowsPRRecord[];
  injuries: ThrowsInjuryRecord[];
  throwsProfiles: ThrowsProfileSummary[];
}

export function ProfileTabs({ profile, throwsPRs, injuries, throwsProfiles }: ProfileTabsProps) {
  // Sync active tab with ?tab= query param so refresh preserves position and
  // coaches can share deep links to specific tabs. Falls back to `core` if
  // the param is missing or invalid.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const initialTab: TabId = TABS.some((t) => t.id === tabFromUrl) ? (tabFromUrl as TabId) : "core";
  const [active, setActive] = useState<TabId>(initialTab);

  // Keep URL in sync when the active tab changes. Using `replace` so back
  // button doesn't have a history entry per tab-switch.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (active === "core") {
      params.delete("tab");
    } else {
      params.set("tab", active);
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  }, [active, pathname, router, searchParams]);

  const handleSwitch = useCallback((next: TabId) => {
    setActive(next);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Icon Tab Bar ───────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-1.5">
        <div className="grid grid-cols-6 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitch(tab.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                    : "text-muted hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]/50"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="hidden min-[360px]:block truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────── */}
      <div key={active} className="animate-fade-slide-in">
        {active === "core" && <TabCore profile={profile} />}
        {active === "comp" && <TabCompetition profile={profile} throwsProfiles={throwsProfiles} />}
        {active === "impl" && (
          <TabImplements throwsPRs={throwsPRs} events={profile.events} gender={profile.gender} />
        )}
        {active === "strength" && <TabStrength profile={profile} />}
        {active === "tech" && <TabTechnical profile={profile} />}
        {active === "injury" && <TabInjury injuries={injuries} profile={profile} />}
      </div>
    </div>
  );
}
