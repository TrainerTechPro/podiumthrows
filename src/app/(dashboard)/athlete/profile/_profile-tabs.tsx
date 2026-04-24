"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  User,
  Trophy,
  Scale,
  Dumbbell,
  Target,
  ShieldAlert,
  ChevronDown,
  type LucideIcon,
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
import { TabTechnical } from "./_tab-technical";
import { TabInjury } from "./_tab-injury";

/* ─── Tab definitions ────────────────────────────────────────────────── */

const TABS = [
  { id: "core", label: "Core Info", shortLabel: "Core", icon: User },
  { id: "comp", label: "Competition", shortLabel: "Comp", icon: Trophy },
  { id: "impl", label: "Implements", shortLabel: "Impl", icon: Scale },
  { id: "strength", label: "Strength", shortLabel: "Strength", icon: Dumbbell },
  { id: "tech", label: "Technical", shortLabel: "Tech", icon: Target },
  { id: "injury", label: "Injury", shortLabel: "Injury", icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]["id"];
type TabDef = (typeof TABS)[number];

/* ─── Component ──────────────────────────────────────────────────────── */

interface ProfileTabsProps {
  profile: ProfileData;
  throwsPRs: ThrowsPRRecord[];
  injuries: ThrowsInjuryRecord[];
  throwsProfiles: ThrowsProfileSummary[];
}

export function ProfileTabs({ profile, throwsPRs, injuries, throwsProfiles }: ProfileTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const initialTab: TabId = TABS.some((t) => t.id === tabFromUrl) ? (tabFromUrl as TabId) : "core";
  // `active` is nullable on mobile only — collapsing a section via retap
  // sets it null. Desktop switches always supply a TabId.
  const [active, setActive] = useState<TabId | null>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!active || active === "core") {
      params.delete("tab");
    } else {
      params.set("tab", active);
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  }, [active, pathname, router, searchParams]);

  const handleSwitch = useCallback((next: TabId | null) => {
    setActive(next);
  }, []);

  const renderPanel = useCallback(
    (id: TabId): ReactNode => {
      switch (id) {
        case "core":
          return <TabCore profile={profile} />;
        case "comp":
          return <TabCompetition profile={profile} throwsProfiles={throwsProfiles} />;
        case "impl":
          return (
            <TabImplements throwsPRs={throwsPRs} events={profile.events} gender={profile.gender} />
          );
        case "strength":
          return <TabStrength profile={profile} />;
        case "tech":
          return <TabTechnical profile={profile} />;
        case "injury":
          return <TabInjury injuries={injuries} profile={profile} />;
      }
    },
    [profile, throwsPRs, injuries, throwsProfiles]
  );

  return (
    <>
      {/* ── Mobile: accordion ─────────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {TABS.map((tab) => (
          <AccordionSection
            key={tab.id}
            tab={tab}
            open={active === tab.id}
            onToggle={() => handleSwitch(active === tab.id ? null : tab.id)}
          >
            {active === tab.id && renderPanel(tab.id)}
          </AccordionSection>
        ))}
      </div>

      {/* ── Desktop: horizontal tabs ──────────────────────────────────── */}
      <div className="hidden sm:block space-y-6">
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
                  aria-pressed={isActive}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                      : "text-muted hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]/50"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span className="truncate">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div key={active ?? "core"} className="animate-fade-slide-in">
          {renderPanel(active ?? "core")}
        </div>
      </div>
    </>
  );
}

/* ─── Accordion section (mobile only) ────────────────────────────────── */

function AccordionSection({
  tab,
  open,
  onToggle,
  children,
}: {
  tab: TabDef;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon: LucideIcon = tab.icon;
  const panelId = `profile-panel-${tab.id}`;
  const buttonId = `profile-trigger-${tab.id}`;
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll into view when opened (so content lands in thumb zone on mobile).
  // Only fires on transition to open — skips if already open on first render.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <section
      ref={sectionRef}
      className={cn(
        "rounded-xl border transition-colors",
        open ? "border-primary-500/40" : "border-[var(--card-border)]"
      )}
    >
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-4 text-left min-h-[56px] rounded-xl transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/50",
          open ? "bg-primary-500/5" : "bg-[var(--card-bg)] hover:bg-[var(--muted-bg)]/30"
        )}
      >
        <span
          className={cn(
            "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
            open
              ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
              : "bg-[var(--muted-bg)]/60 text-muted"
          )}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0 text-base font-semibold text-[var(--foreground)]">
          {tab.label}
        </span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="px-4 pb-5 pt-1 animate-fade-slide-in"
        >
          {children}
        </div>
      )}
    </section>
  );
}
