"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { Sun, Moon, Menu, X, LogOut, Search } from "lucide-react";
import {
  Sidebar,
  COACH_NAV_SECTIONS,
  ATHLETE_NAV_SECTIONS,
  NavSection,
} from "@/components/ui/Sidebar";
import { CommandPalette, openCommandPalette } from "@/components/ui/CommandPalette";
import { Breadcrumbs, BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toast";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { QuickActions } from "@/components/ui/QuickActions";
import { useDetectTimezone } from "@/hooks/useDetectTimezone";

/* ─── Theme toggle ───────────────────────────────────────────────────────── */

function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const nowDark = !isDark;
    document.documentElement.classList.toggle("dark", nowDark);
    document.cookie = `theme=${nowDark ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
    setIsDark(nowDark);
  }

  return (
    <button
      onClick={toggle}
      className="p-3 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun size={20} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Moon size={20} strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );
}

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
  /** Override nav sections (uses role defaults if omitted) */
  navSections?: NavSection[];
  /** Slot for page-level actions in the top bar */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Unread notification count — shown as badge on Notifications nav item (coach only) */
  notificationCount?: number;
}

/* ─── Hamburger button ───────────────────────────────────────────────────── */

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

/* ─── Logo mark ──────────────────────────────────────────────────────────── */

function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Podium Throws"
      width={size}
      height={size}
      className="rounded-xl shrink-0"
      priority
    />
  );
}

/* ─── Sidebar header (logo + user) ──────────────────────────────────────── */

function SidebarHeader({ user: _user }: { user: DashboardUser }) {
  return (
    <div className="space-y-3">
      <LogoMark />
    </div>
  );
}

/* ─── Sidebar footer (user profile) ─────────────────────────────────────── */

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

/* ─── User menu (avatar + logout dropdown) ────────────────────────────── */

function UserMenu({ user }: { user: DashboardUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

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
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-[var(--card-border)]">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">{user.name}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Top bar ────────────────────────────────────────────────────────────── */

function TopBar({
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
      className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--card-border)] px-4 sm:px-6 min-h-[3.5rem] flex items-center gap-4 shrink-0"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Hamburger (mobile) */}
      <HamburgerButton open={sidebarOpen} onClick={onToggleSidebar} />

      {/* Logo (mobile only — desktop shows in sidebar) */}
      <div className="lg:hidden">
        <LogoMark size={38} />
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="hidden sm:flex flex-1 min-w-0">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search trigger */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors border border-transparent hover:border-[var(--card-border)]"
        aria-label="Search"
      >
        <Search size={16} strokeWidth={2} aria-hidden="true" />
        <span className="hidden sm:inline text-surface-400">Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* Mode toggle — always visible in header when training enabled */}
      {user.trainingEnabled && (
        <ModeToggle activeMode={(user.activeMode as "COACH" | "TRAINING") ?? "COACH"} />
      )}

      {/* Notification bell */}
      <NotificationBell initialCount={notificationCount ?? 0} role={user.role} />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* User menu */}
      <UserMenu user={user} />
    </header>
  );
}

/* ─── Main Layout ────────────────────────────────────────────────────────── */

export function DashboardLayout({
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
  useDetectTimezone();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isTrainingMode = user.role === "COACH" && user.activeMode === "TRAINING";
  const baseSections =
    navSections ??
    (isTrainingMode
      ? ATHLETE_NAV_SECTIONS
      : user.role === "COACH"
        ? COACH_NAV_SECTIONS
        : ATHLETE_NAV_SECTIONS);

  // Inject unread badge onto the Notifications nav item (both roles)
  const notifHref =
    user.role === "COACH" || isTrainingMode ? "/coach/notifications" : "/athlete/notifications";
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
    <ToastProvider>
      <div className="flex h-screen bg-[var(--background)] overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          sections={sections}
          header={<SidebarHeader user={user} />}
          footer={<SidebarFooter user={user} />}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Cmd+K command palette */}
        <CommandPalette sections={sections} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <TopBar
            user={user}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            breadcrumbs={breadcrumbs}
            actions={actions}
            notificationCount={notificationCount}
          />

          {/* Page content */}
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

        {/* Quick Actions FAB */}
        <QuickActions role={isTrainingMode ? "ATHLETE" : user.role} />
      </div>
    </ToastProvider>
  );
}
