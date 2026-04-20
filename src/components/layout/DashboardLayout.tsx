"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { Sun, Moon, Menu, X, LogOut, Search, Settings } from "lucide-react";
import { Sidebar, COACH_NAV_SECTIONS, NavSection } from "@/components/ui/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { CommandPalette, openCommandPalette } from "@/components/ui/CommandPalette";
import { Breadcrumbs, BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toast";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { QuickActions } from "@/components/ui/QuickActions";
import { useDetectTimezone } from "@/hooks/useDetectTimezone";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface DashboardUser {
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
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: csrfHeaders() });
    } catch {
      /* proceed anyway */
    }
    router.push("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/50"
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
              <Sun size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Moon size={16} strokeWidth={2} aria-hidden="true" />
            )}
            {isDark ? "Switch to light mode" : "Switch to dark mode"}
          </button>

          <Link
            href={settingsHref}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <Settings size={16} strokeWidth={2} aria-hidden="true" />
            Settings
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-t border-[var(--card-border)]"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
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
      className="lg:hidden p-3 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
    >
      {open ? (
        <X size={20} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Menu size={20} strokeWidth={2} aria-hidden="true" />
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
      className="sticky top-0 z-20 bg-[var(--background)] border-b border-[var(--card-border)] px-4 sm:px-6 min-h-[3.5rem] flex items-center gap-4 shrink-0"
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
        <Search size={16} strokeWidth={2} aria-hidden="true" />
        <span className="text-surface-400">Search</span>
        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          ⌘K
        </kbd>
      </button>

      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {user.trainingEnabled && (
        <ModeToggle activeMode={(user.activeMode as "COACH" | "TRAINING") ?? "COACH"} />
      )}

      <NotificationBell initialCount={notificationCount ?? 0} role={user.role} />

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
    <div className="flex h-screen bg-[var(--background)] overflow-hidden">
      <Sidebar
        sections={sections}
        header={<SidebarHeader />}
        footer={<SidebarFooter user={user} />}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <CommandPalette sections={sections} />

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
    <header
      className="sticky top-0 z-20 bg-[var(--background)] border-b border-[var(--color-border-default)] px-4 min-h-[3.5rem] flex items-center gap-3 shrink-0"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <LogoMark size={34} />

      <div className="flex-1" />

      <NotificationBell initialCount={notificationCount ?? 0} role={user.role} />
      <UserMenu user={user} settingsHref="/athlete/settings" />
    </header>
  );
}

function AthleteShell({ user, children, className, notificationCount }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-[var(--background)] overflow-hidden">
      <AthleteTopBar user={user} notificationCount={notificationCount} />

      <main
        id="main-content"
        className={cn("flex-1 overflow-y-auto custom-scrollbar", "px-4 sm:px-6 py-5", className)}
        // Bottom padding = tab bar height (64) + safe area + breathing room
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </main>

      <BottomTabBar />
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
      {isAthleteShell ? <AthleteShell {...props} /> : <CoachShell {...props} />}
    </ToastProvider>
  );
}
