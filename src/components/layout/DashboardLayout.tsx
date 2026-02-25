"use client";

import { useState, ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  COACH_NAV_SECTIONS,
  ATHLETE_NAV_SECTIONS,
  NavSection,
} from "@/components/ui/Sidebar";
import { Breadcrumbs, BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toast";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface DashboardUser {
  name: string;
  email: string;
  role: "COACH" | "ATHLETE";
  avatarUrl?: string | null;
  plan?: string;
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

function HamburgerButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {open ? (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        ) : (
          <>
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </>
        )}
      </svg>
    </button>
  );
}

/* ─── Logo mark ──────────────────────────────────────────────────────────── */

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center shrink-0">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold font-heading text-[var(--foreground)]">Podium</p>
        <p className="text-[10px] font-medium text-muted -mt-0.5">Throws</p>
      </div>
    </div>
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
          {user.plan && ` · ${user.plan}`}
        </p>
      </div>
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
}: {
  user: DashboardUser;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--card-border)] px-4 sm:px-6 h-14 flex items-center gap-4 shrink-0">
      {/* Hamburger (mobile) */}
      <HamburgerButton open={sidebarOpen} onClick={onToggleSidebar} />

      {/* Logo (mobile only — desktop shows in sidebar) */}
      <div className="lg:hidden">
        <LogoMark />
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="hidden sm:flex flex-1 min-w-0">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
      )}

      {/* User avatar (mobile) */}
      <div className="lg:hidden">
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      </div>
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const baseSections =
    navSections ??
    (user.role === "COACH" ? COACH_NAV_SECTIONS : ATHLETE_NAV_SECTIONS);

  // Inject unread badge onto the Notifications nav item (coach only)
  const sections =
    user.role === "COACH" && notificationCount && notificationCount > 0
      ? baseSections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.href === "/coach/notifications"
              ? { ...item, badge: notificationCount }
              : item
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

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <TopBar
            user={user}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            breadcrumbs={breadcrumbs}
            actions={actions}
          />

          {/* Page content */}
          <main
            id="main-content"
            className={cn(
              "flex-1 overflow-y-auto custom-scrollbar",
              "px-4 sm:px-6 lg:px-8 py-6",
              className
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
