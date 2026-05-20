"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { clearAllUserDrafts } from "@/lib/draft-persistence";
import { Sun, Moon, Menu, X, LogOut, Search, Settings } from "lucide-react";
import { Sidebar, COACH_NAV_SECTIONS, NavSection } from "@/components/ui/Sidebar";
import { SkipLink } from "@/components/ui/SkipLink";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { CommandPalette, openCommandPalette } from "@/components/ui/CommandPalette";
import { KeyboardShortcutsModal } from "@/components/ui/KeyboardShortcutsModal";
import { Breadcrumbs, BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toast";
import { UnitPrefErrorToast } from "@/lib/units/provider";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { QuickActions } from "@/components/ui/QuickActions";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { CoachFeedbackInboxIcon } from "@/components/feedback/CoachFeedbackInboxIcon";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { useDetectTimezone } from "@/hooks/useDetectTimezone";
import Link from "next/link";
import { logger } from "@/lib/logger";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface DashboardUser {
  /** Underlying User.id from the JWT session — used to scope per-user
   *  IndexedDB draft cleanup on logout (see clearAllUserDrafts). */
  userId: string;
  name: string;
  email: string;
  role: "COACH" | "ATHLETE";
  avatarUrl?: string | null;
  plan?: string;
  activeMode?: string;
  trainingEnabled?: boolean;
}

export interface DashboardLayoutProps {
  user: DashboardUser;
  breadcrumbs?: BreadcrumbItem[];
  /** Override nav sections (uses role defaults if omitted). Coach-shell only. */
  navSections?: NavSection[];
  /** Slot for page-level actions in the top bar */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Unread notification count */
  notificationCount?: number;
}

/* ─── Logo mark ──────────────────────────────────────────────────────────── */

function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      src="/podium-throws-logo.png"
      alt="Podium Throws"
      width={size}
      height={size}
      className="rounded-xl shrink-0"
      priority
      sizes="44px"
    />
  );
}

/* ─── User Menu — shared chrome for both shells ────────────────────────────
   One place for secondary actions that don't belong in primary nav:
   theme toggle, settings shortcut, log out. Previously the theme toggle
   sat in the top bar as a persistent control — that was a set-and-forget
   preference occupying prime real estate. Moved here. ──────────────────── */

function UserMenu({ user, settingsHref }: { user: DashboardUser; settingsHref: string }) {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleTheme() {
    const nowDark = !isDark;
    document.documentElement.classList.toggle("dark", nowDark);
    document.cookie = `theme=${nowDark ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
    setIsDark(nowDark);
  }

  async function handleLogout() {
    // Clear this user's IndexedDB drafts BEFORE the network call so a logout
    // that times out or 5xxs still leaves no PII on the device for the next
    // sign-in. clearAllUserDrafts swallows IDB errors internally.
    await clearAllUserDrafts(user.userId);

    try {
      await fetch("/api/auth/logout", { method: "POST", headers: csrfHeaders() });
    } catch (err) {
      // proceed anyway
      logger.debug("proceed anyway", {
        context: "src/components/layout/DashboardLayout.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
    router.push("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-[var(--surface-overlay)] border border-[var(--card-border)] shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-[var(--card-border)]">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">{user.name}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            {isDark ? (
              <Sun size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Moon size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            {isDark ? "Switch to light mode" : "Switch to dark mode"}
          </button>

          <Link
            href={settingsHref}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
            Settings
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-t border-[var(--card-border)]"
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Coach Shell ──────────────────────────────────────────────────────────
   Desktop-optimized, info-dense back-office. Sidebar + top bar with
   breadcrumbs, command palette, action slot. This is the tool that sells
   the subscription — it needs to feel like research software.
   ─────────────────────────────────────────────────────────────────────── */

function HamburgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-3 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
    >
      {open ? (
        <X size={20} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}

function CoachTopBar({
  user,
  sidebarOpen,
  onToggleSidebar,
  breadcrumbs,
  actions,
  notificationCount,
}: {
  user: DashboardUser;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  notificationCount?: number;
}) {
  return (
    <header
      className="sticky top-0 z-20 bg-[var(--background)] border-b border-[var(--card-border)] px-4 sm:px-6 min-h-[3.5rem] flex items-center gap-4 shrink-0 max-sm:relative"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <HamburgerButton open={sidebarOpen} onClick={onToggleSidebar} />

      {/* Logo (mobile only — desktop shows in sidebar) */}
      <div className="lg:hidden">
        <LogoMark size={38} />
      </div>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="hidden sm:flex flex-1 min-w-0">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      <div className="flex-1" />

      {/* Command palette trigger — desktop only. On mobile this is noise;
          coaches on mobile want breadcrumbs + actions, not ⌘K. */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors border border-transparent hover:border-[var(--card-border)]"
        aria-label="Search"
      >
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-surface-400">Search</span>
        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-nano font-mono font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          ⌘K
        </kbd>
      </button>

      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {user.role === "COACH" && user.trainingEnabled && (
        <ModeToggle
          activeMode={(user.activeMode as "COACH" | "TRAINING") ?? "COACH"}
          compact
          className="max-sm:absolute max-sm:left-1/2 max-sm:-translate-x-1/2"
        />
      )}

      <NotificationBell initialCount={notificationCount ?? 0} role={user.role} />

      <CoachFeedbackInboxIcon className="max-sm:hidden" />

      <UserMenu user={user} settingsHref="/coach/settings" />
    </header>
  );
}

function SidebarHeader() {
  return (
    <div className="space-y-3">
      <LogoMark />
    </div>
  );
}

function SidebarFooter({ user }: { user: DashboardUser }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar name={user.name} src={user.avatarUrl} size="sm" status="online" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">{user.name}</p>
        <p className="text-xs text-muted truncate capitalize">
          {user.role.toLowerCase()}
          {user.plan && (
            <span className="text-primary-500 dark:text-primary-400"> · {user.plan}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function CoachShell({
  user,
  breadcrumbs,
  navSections,
  actions,
  children,
  className,
  notificationCount,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const baseSections = navSections ?? COACH_NAV_SECTIONS;
  const notifHref = "/coach/notifications";
  const sections =
    notificationCount && notificationCount > 0
      ? baseSections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.href === notifHref ? { ...item, badge: notificationCount } : item
          ),
        }))
      : baseSections;

  return (
    // h-[100dvh] works on both desktop and mobile-on-sideline browsers
    // without the iOS Safari 100vh URL-bar crop.
    <div className="flex h-[100dvh] bg-[var(--background)] overflow-hidden">
      <SkipLink />
      <Sidebar
        sections={sections}
        header={<SidebarHeader />}
        footer={<SidebarFooter user={user} />}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <CommandPalette sections={sections} />
      <KeyboardShortcutsModal />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <CoachTopBar
          user={user}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          breadcrumbs={breadcrumbs}
          actions={actions}
          notificationCount={notificationCount}
        />

        <main
          id="main-content"
          className={cn(
            "flex-1 overflow-y-auto custom-scrollbar",
            "px-4 sm:px-6 lg:px-8 py-6",
            className
          )}
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </main>
      </div>

      <QuickActions role={user.role} />
      <FeedbackButton role="COACH" />
    </div>
  );
}

/* ─── Athlete Shell ────────────────────────────────────────────────────────
   Mobile-native consumer app. Minimal top bar (logo + notifications +
   avatar), full-bleed content, bottom tab bar. No sidebar, no hamburger,
   no command palette — athletes navigate by thumb.
   ─────────────────────────────────────────────────────────────────────── */

function AthleteTopBar({
  user,
  notificationCount,
}: {
  user: DashboardUser;
  notificationCount?: number;
}) {
  return (
    <>
      <header
        // Athlete chrome is slimmer than coach (52px vs 56px) — every pixel of
        // viewport matters when the primary CTA has to land in the thumb half
        // on iPhone SE (375x667). The bell + avatar buttons keep 44px hit
        // targets internally; this container just trims breathing room.
        className="sticky top-0 z-20 bg-[var(--background)] border-b border-[var(--color-border-default)] px-4 min-h-[3.25rem] flex items-center gap-3 shrink-0 relative"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <LogoMark size={40} />

        <div className="flex-1" />

        {user.role === "COACH" && user.trainingEnabled && (
          <ModeToggle
            activeMode={(user.activeMode as "COACH" | "TRAINING") ?? "TRAINING"}
            compact
            className="absolute left-1/2 -translate-x-1/2"
          />
        )}
        <NotificationBell initialCount={notificationCount ?? 0} role={user.role} />
        <UserMenu user={user} settingsHref="/athlete/settings" />
      </header>
      {/* Surfaces a small "you're offline" pill below the top bar when
          navigator.onLine flips false. Trends/dashboard otherwise show
          stale data with no indicator. */}
      <OfflineIndicator />
    </>
  );
}

// Routes where we hide the BottomTabBar + feedback FAB — focused-task flows
// where thumb-zone chrome would compete with the form's own sticky controls
// and the iOS keyboard. Matches how Strava/Whoop collapse chrome mid-log.
export const FOCUS_MODE_PREFIXES = [
  "/athlete/log-session",
  "/athlete/onboarding",
  "/athlete/self-program/create",
];

export function isFocusMode(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return FOCUS_MODE_PREFIXES.some((p) => pathname.startsWith(p));
}

function AthleteShell({ user, children, className, notificationCount }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const focusMode = isFocusMode(pathname);

  // Mark <body> with `athlete-shell` so portaled UI (toasts, modals, sheets
  // — including the haptic hook) can detect the shell from a detached tree.
  // The class is also kept on the wrapper div for layout-scoped CSS.
  useEffect(() => {
    document.body.classList.add("athlete-shell");
    return () => document.body.classList.remove("athlete-shell");
  }, []);

  return (
    <div
      className={cn(
        // h-[100dvh] avoids the iOS Safari URL-bar cropping that h-screen
        // (100vh) suffers; the bottom-tab bar otherwise gets clipped.
        "athlete-shell flex flex-col h-[100dvh] bg-[var(--background)] overflow-hidden",
        focusMode && "athlete-shell-focus"
      )}
    >
      <SkipLink />
      <AthleteTopBar user={user} notificationCount={notificationCount} />

      <main
        id="main-content"
        className={cn("flex-1 overflow-y-auto custom-scrollbar", "px-4 sm:px-6 py-5", className)}
        // In focus mode the tab bar is hidden, so main only needs safe-area padding.
        // Otherwise reserve tab-bar height (64) + safe-area + breathing room.
        style={{
          paddingBottom: focusMode
            ? "calc(1rem + env(safe-area-inset-bottom, 0px))"
            : "calc(5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <PullToRefresh
          disabled={focusMode}
          onRefresh={async () => {
            router.refresh();
            // Let other client components (notifications list, team feed)
            // opt into a custom refetch by listening to this event.
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("podium:pull-to-refresh"));
            }
            // Yield a frame so the indicator has time to render its
            // committed state before we resolve.
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
          }}
        >
          {children}
        </PullToRefresh>
      </main>

      {!focusMode && <BottomTabBar />}
      {!focusMode && <FeedbackButton role="ATHLETE" />}
    </div>
  );
}

/* ─── Main Layout ────────────────────────────────────────────────────────── */

export function DashboardLayout(props: DashboardLayoutProps) {
  useDetectTimezone();

  const { user } = props;
  const isAthleteShell =
    user.role === "ATHLETE" || (user.role === "COACH" && user.activeMode === "TRAINING");

  return (
    <ToastProvider>
      <UnitPrefErrorToast />
      {isAthleteShell ? <AthleteShell {...props} /> : <CoachShell {...props} />}
    </ToastProvider>
  );
}
