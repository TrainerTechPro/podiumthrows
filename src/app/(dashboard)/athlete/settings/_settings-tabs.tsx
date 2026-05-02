"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, Bell, Zap, Lock, ChevronRight } from "lucide-react";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { Avatar } from "@/components";
import { AthleteSettingsForm } from "./_form";
import { QuickActionsSettings } from "@/components/ui/QuickActionsSettings";
import { FeedPrivacySettings } from "@/components/feedback/FeedPrivacySettings";
import { HapticsSettings } from "@/components/settings/HapticsSettings";
import { ExportDataButton } from "@/components/settings/ExportDataButton";
import { SendFeedbackCard } from "@/components/feedback/SendFeedbackCard";
import { DeliveryPreferencesSection } from "@/components/delivery-preferences-section";
import { NotificationPreferencesClient } from "./notifications/_notification-preferences-client";
import type { AthleteProfileFull } from "@/lib/data/athlete";
import type { PushPreferences } from "@/lib/push/preferences";

/* ─── Tabbed athlete settings shell ───────────────────────────────────────
   Single page, five tabs, deep-linkable via ?tab=. All data is server-
   fetched and passed in as props so the page renders instantly per tab —
   the underlying sub-component fetches (notifications, etc.) only run
   when that tab is opened.
   ─────────────────────────────────────────────────────────────────────── */

const TAB_IDS = ["profile", "notifications", "integrations", "privacy", "account"] as const;
type TabId = (typeof TAB_IDS)[number];

const ICON_PROPS = { size: 14, strokeWidth: 1.75, "aria-hidden": true } as const;

const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "profile", label: "Profile", icon: <User {...ICON_PROPS} /> },
  { id: "notifications", label: "Notifications", icon: <Bell {...ICON_PROPS} /> },
  { id: "integrations", label: "Integrations", icon: <Zap {...ICON_PROPS} /> },
  { id: "privacy", label: "Privacy", icon: <Lock {...ICON_PROPS} /> },
  { id: "account", label: "Account", icon: <User {...ICON_PROPS} /> },
];

function isTabId(v: string | null | undefined): v is TabId {
  return !!v && (TAB_IDS as readonly string[]).includes(v);
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface AthleteSettingsTabsProps {
  profile: AthleteProfileFull;
  connectedDevices: number;
  notificationPreferences: PushPreferences;
}

export function AthleteSettingsTabs({
  profile,
  connectedDevices,
  notificationPreferences,
}: AthleteSettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: TabId = isTabId(searchParams?.get("tab"))
    ? (searchParams!.get("tab") as TabId)
    : "profile";
  const [active, setActive] = useState<TabId>(initialTab);

  // Keep URL in sync so refresh + share preserve the tab. Use replace so
  // the back button doesn't accumulate one entry per tab switch.
  useEffect(() => {
    const current = searchParams?.get("tab");
    if (current === active) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (active === "profile") params.delete("tab");
    else params.set("tab", active);
    const qs = params.toString();
    router.replace(qs ? `/athlete/settings?${qs}` : "/athlete/settings", { scroll: false });
  }, [active, router, searchParams]);

  // Keep active in sync if the URL changes externally (e.g. a Link click).
  useEffect(() => {
    const fromUrl = searchParams?.get("tab");
    if (isTabId(fromUrl) && fromUrl !== active) setActive(fromUrl);
    else if (!fromUrl && active !== "profile") setActive("profile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const eventsLabel = useMemo(
    () => profile.events.map(formatEventName).join(", "),
    [profile.events]
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your athlete profile.</p>
      </div>

      <Tabs activeTab={active} onChange={(id) => setActive(id as TabId)} defaultTab="profile">
        <TabList variant="underline" className="overflow-x-auto custom-scrollbar -mx-2 px-2">
          {TABS.map((t) => (
            <TabTrigger key={t.id} id={t.id} variant="underline" icon={t.icon}>
              {t.label}
            </TabTrigger>
          ))}
        </TabList>

        {/* ── Profile ──────────────────────────────────────────────────── */}
        <TabPanel id="profile" className="pt-6 space-y-6">
          <div className="card px-5 py-5 flex items-center gap-4">
            <Avatar
              name={`${profile.firstName} ${profile.lastName}`}
              src={profile.avatarUrl}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-[var(--foreground)]">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-sm text-muted truncate">{profile.email}</p>
              <p className="text-xs text-muted mt-0.5">
                Member since {formatDate(profile.memberSince)}
                {eventsLabel && <> · {eventsLabel}</>}
              </p>
            </div>
          </div>

          <div className="card px-5 py-4 flex items-center gap-3">
            <Avatar name={profile.coachName} src={profile.coachAvatar} size="sm" />
            <div className="min-w-0">
              <p className="text-xs text-muted uppercase tracking-wide">Your Coach</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">{profile.coachName}</p>
            </div>
          </div>

          <AthleteSettingsForm profile={profile} />
          <QuickActionsSettings role="ATHLETE" />
        </TabPanel>

        {/* ── Notifications ────────────────────────────────────────────── */}
        <TabPanel id="notifications" className="pt-6 space-y-6">
          <DeliveryPreferencesSection />
          <NotificationPreferencesClient initialPreferences={notificationPreferences} />
        </TabPanel>

        {/* ── Integrations ─────────────────────────────────────────────── */}
        <TabPanel id="integrations" className="pt-6 space-y-3">
          <Link
            href="/athlete/integrations"
            className="card card-interactive p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
              <Zap size={20} className="text-primary-500" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Wearable Integrations
              </p>
              <p className="text-xs text-muted">
                {connectedDevices > 0
                  ? `${connectedDevices} device${connectedDevices > 1 ? "s" : ""} connected`
                  : "Connect WHOOP, Oura Ring, and more"}
              </p>
            </div>
            <ChevronRight size={16} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
          </Link>
          <p className="text-xs text-muted px-1">
            Manage individual device connections, sync mode, and sync errors on the integrations
            page.
          </p>
        </TabPanel>

        {/* ── Privacy ─────────────────────────────────────────────────── */}
        <TabPanel id="privacy" className="pt-6 space-y-6">
          <FeedPrivacySettings />
          <HapticsSettings />

          <section className="card p-5 space-y-3">
            <header className="space-y-1">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Your data
              </h2>
              <p className="text-sm text-[var(--foreground)]">
                Download everything we&apos;ve stored about you — sessions, throws, notes, settings.
                Other athletes&apos; data is never included.
              </p>
            </header>
            <ExportDataButton />
            <p className="text-xs text-muted">Limited to one download per day.</p>
          </section>
        </TabPanel>

        {/* ── Account ─────────────────────────────────────────────────── */}
        <TabPanel id="account" className="pt-6 space-y-6">
          <section className="card p-5 space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Account</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-sm text-muted">{profile.email}</p>
            <p className="text-xs text-muted">Member since {formatDate(profile.memberSince)}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Feedback</h2>
            <SendFeedbackCard />
          </section>
        </TabPanel>
      </Tabs>
    </div>
  );
}
