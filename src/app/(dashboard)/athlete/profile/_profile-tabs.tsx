"use client";

import { useState } from "react";
import {
  User,
  Trophy,
  Scale,
  Dumbbell,
  Target,
  ShieldAlert,
} from "lucide-react";
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

export function ProfileTabs({
  profile,
  throwsPRs,
  injuries,
  throwsProfiles,
}: ProfileTabsProps) {
  const [active, setActive] = useState<TabId>("core");

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
                onClick={() => setActive(tab.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                    : "text-muted hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]/50"
                )}
              >
                <Icon
                  className="w-5 h-5 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="hidden min-[360px]:block truncate">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────── */}
      <div key={active} className="animate-fade-slide-in">
        {active === "core" && <TabCore profile={profile} />}
        {active === "comp" && (
          <TabCompetition profile={profile} throwsProfiles={throwsProfiles} />
        )}
        {active === "impl" && (
          <TabImplements
            throwsPRs={throwsPRs}
            events={profile.events}
            gender={profile.gender}
          />
        )}
        {active === "strength" && <TabStrength profile={profile} />}
        {active === "tech" && (
          <TabPlaceholder
            title="Technical Profile"
            description="Primary limiters, strengths, weaknesses, and coaching cues."
          />
        )}
        {active === "injury" && (
          <TabPlaceholder
            title="Injury History"
            description={`${injuries.length} injury record(s) — dates, restrictions, and recovery status.`}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Placeholder card for each tab ──────────────────────────────────── */

function TabPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-8 text-center">
      <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-surface-100 dark:bg-surface-800 px-4 py-2 text-xs text-muted">
        <span className="w-2 h-2 rounded-full bg-primary-500/50 animate-pulse" />
        Content coming soon
      </div>
    </div>
  );
}
