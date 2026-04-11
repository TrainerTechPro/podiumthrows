"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/ui/ModeToggle";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Target,
  Dumbbell,
  Heart,
  Settings,
  Bell,
  Radio,
  CalendarRange,
  UserCircle,
  BarChart3,
  UserPlus,
  ChevronRight,
  ScanLine,
  Trophy,
  PlusCircle,
  Clock,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
  /** Items that also count as "active" for this link */
  matchPaths?: string[];
  /** Collapsible sub-items */
  children?: NavItem[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface SidebarProps {
  /** Array of nav sections */
  sections: NavSection[];
  /** Shown at the top of the sidebar */
  header?: ReactNode;
  /** Shown at the bottom */
  footer?: ReactNode;
  open: boolean;
  onClose: () => void;
  className?: string;
  /** Whether the coach has enabled training mode */
  trainingEnabled?: boolean;
  /** Current active mode */
  activeMode?: "COACH" | "TRAINING";
}

/* ─── Nav Item ───────────────────────────────────────────────────────────── */

function isItemActive(item: NavItem, pathname: string): boolean {
  return (
    pathname === item.href ||
    pathname.startsWith(item.href + "/") ||
    !!item.matchPaths?.some((p) => pathname === p || pathname.startsWith(p + "/"))
  );
}

function SidebarNavItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const isActive = isItemActive(item, pathname);
  const hasChildren = item.children && item.children.length > 0;

  // Auto-expand if any child is active
  const childActive = hasChildren && item.children!.some((c) => isItemActive(c, pathname));
  const [expanded, setExpanded] = useState(childActive || isActive);

  const isParentActive = isActive || childActive;

  // Parent with children: render as a collapsible button
  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
            isParentActive
              ? "text-primary-700 dark:text-primary-300"
              : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/70 hover:text-surface-900 dark:hover:text-surface-100"
          )}
        >
          <span
            className={cn(
              "w-5 h-5 shrink-0 transition-colors",
              isParentActive
                ? "text-primary-500 dark:text-primary-400"
                : "text-surface-400 dark:text-surface-500 group-hover:text-surface-500 dark:group-hover:text-surface-300"
            )}
          >
            {item.icon}
          </span>
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.badge !== undefined && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
                isParentActive
                  ? "bg-primary-200 dark:bg-primary-500/30 text-primary-700 dark:text-primary-300"
                  : "bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300"
              )}
            >
              {item.badge}
            </span>
          )}
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-200 text-surface-400",
              expanded && "rotate-90"
            )}
          />
        </button>
        {expanded && (
          <ul className="mt-0.5 ml-4 pl-3 border-l border-surface-200 dark:border-surface-700 space-y-0.5">
            {item.children!.map((child) => (
              <li key={child.href}>
                <SidebarNavItem item={child} depth={depth + 1} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Leaf item: render as a link
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 group",
        depth > 0 ? "px-3 py-2" : "px-3 py-2.5",
        isActive
          ? "bg-primary-500/12 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.15)]"
          : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/70 hover:text-surface-900 dark:hover:text-surface-100"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <span
        className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          depth > 0 && "w-4 h-4",
          isActive
            ? "text-primary-500 dark:text-primary-400"
            : "text-surface-400 dark:text-surface-500 group-hover:text-surface-500 dark:group-hover:text-surface-300"
        )}
      >
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && (
        <span
          className={cn(
            "ml-auto min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums shrink-0",
            isActive
              ? "bg-primary-500/20 text-primary-600 dark:text-primary-300"
              : "bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300"
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

export function Sidebar({
  sections,
  header,
  footer,
  open,
  onClose,
  className,
  trainingEnabled,
  activeMode,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          /* Base */
          "fixed top-0 left-0 z-40 h-full w-[260px]",
          "flex flex-col bg-white dark:bg-[#0c0c10] border-r border-[var(--card-border)]",
          /* Mobile: slide in/out */
          "transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0" : "-translate-x-full",
          /* Desktop: always visible */
          "lg:translate-x-0 lg:relative lg:z-auto lg:shrink-0",
          className
        )}
        aria-label="Sidebar navigation"
      >
        {/* Header slot */}
        {header && (
          <div
            className="px-4 py-4 border-b border-[var(--card-border)] shrink-0"
            style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
          >
            {header}
          </div>
        )}

        {/* Mode toggle (coach training mode) */}
        {trainingEnabled && activeMode && (
          <div className="px-4 pt-3 shrink-0">
            <ModeToggle activeMode={activeMode} />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-5">
          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-surface-400 dark:text-surface-500">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <SidebarNavItem item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer slot */}
        {footer && (
          <div className="px-4 py-4 border-t border-[var(--card-border)] shrink-0">{footer}</div>
        )}
      </aside>
    </>
  );
}

/* ─── Shared icon props for consistent sizing ─────────────────────────── */

const iconSize = { size: 20, strokeWidth: 1.75, "aria-hidden": true as const };

/* ─── Pre-built nav configs ─────────────────────────────────────────────── */

export const COACH_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      // ── Dashboard (standalone) ──
      { label: "Dashboard", href: "/coach/dashboard", icon: <LayoutDashboard {...iconSize} /> },

      // ── Athletes ──
      {
        label: "Athletes",
        href: "/coach/athletes",
        icon: <Users {...iconSize} />,
        matchPaths: [
          "/coach/athletes",
          "/coach/invitations",
          "/coach/competitions",
          "/coach/availability",
          "/coach/team",
          "/coach/practices",
          "/coach/hub",
        ],
        children: [
          {
            label: "Roster",
            href: "/coach/athletes",
            icon: <Users {...iconSize} />,
            matchPaths: ["/coach/athletes"],
          },
          { label: "Invitations", href: "/coach/invitations", icon: <UserPlus {...iconSize} /> },
          {
            label: "Competitions",
            href: "/coach/competitions",
            icon: <Trophy {...iconSize} />,
            matchPaths: ["/coach/competitions"],
          },
          {
            label: "Availability",
            href: "/coach/availability",
            icon: <Calendar {...iconSize} />,
            matchPaths: ["/coach/availability"],
          },
          {
            label: "Practices",
            href: "/coach/practices",
            icon: <Calendar {...iconSize} />,
            matchPaths: ["/coach/practices"],
          },
          {
            label: "Team Feed",
            href: "/coach/team",
            icon: <Users {...iconSize} />,
            matchPaths: ["/coach/team"],
          },
          {
            label: "Team Hub",
            href: "/coach/hub",
            icon: <LayoutDashboard {...iconSize} />,
            matchPaths: ["/coach/hub"],
          },
        ],
      },

      // ── Training ──
      {
        label: "Training",
        href: "/coach/throws",
        icon: <Dumbbell {...iconSize} />,
        matchPaths: [
          "/coach/throws",
          "/coach/programming",
        ],
        children: [
          {
            label: "Throws Hub",
            href: "/coach/throws",
            icon: <Target {...iconSize} />,
            matchPaths: ["/coach/throws"],
          },
          {
            label: "Programming",
            href: "/coach/programming",
            icon: <CalendarRange {...iconSize} />,
            matchPaths: ["/coach/programming"],
          },
          {
            label: "Live Practice",
            href: "/coach/throws/practice",
            icon: <Radio {...iconSize} />,
            matchPaths: ["/coach/throws/practice"],
          },
        ],
      },

      // ── Analyze ──
      {
        label: "Analyze",
        href: "/coach/video-analysis",
        icon: <BarChart3 {...iconSize} />,
        matchPaths: [
          "/coach/video-analysis",
        ],
        children: [
          {
            label: "Pose Analysis",
            href: "/coach/video-analysis",
            icon: <ScanLine {...iconSize} />,
            matchPaths: ["/coach/video-analysis"],
          },
        ],
      },
    ],
  },
  {
    items: [
      { label: "Notifications", href: "/coach/notifications", icon: <Bell {...iconSize} /> },
      {
        label: "Settings",
        href: "/coach/settings",
        icon: <Settings {...iconSize} />,
        matchPaths: ["/coach/settings"],
      },
    ],
  },
];

export const ATHLETE_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "My Dashboard",
        href: "/athlete/dashboard",
        icon: <LayoutDashboard {...iconSize} />,
      },
      {
        label: "Training",
        href: "/athlete/sessions",
        icon: <Calendar {...iconSize} />,
        matchPaths: ["/athlete/sessions"],
      },
      {
        label: "Throws",
        href: "/athlete/throws",
        icon: <Target {...iconSize} />,
        matchPaths: [
          "/athlete/throws",
          "/athlete/throws/log",
          "/athlete/throws/history",
          "/athlete/throws/session",
          "/athlete/throws/trends",
          "/athlete/throws/readiness",
        ],
        children: [
          {
            label: "Today",
            href: "/athlete/throws",
            icon: <Target {...iconSize} />,
            matchPaths: ["/athlete/throws"],
          },
          {
            label: "Log a Throw",
            href: "/athlete/throws/log",
            icon: <PlusCircle {...iconSize} />,
            matchPaths: ["/athlete/throws/log"],
          },
          {
            label: "History",
            href: "/athlete/throws/history",
            icon: <Clock {...iconSize} />,
            matchPaths: ["/athlete/throws/history", "/athlete/throws/session"],
          },
          {
            label: "Trends & PRs",
            href: "/athlete/throws/trends",
            icon: <BarChart3 {...iconSize} />,
            matchPaths: ["/athlete/throws/trends"],
          },
          {
            label: "Readiness",
            href: "/athlete/throws/readiness",
            icon: <Heart {...iconSize} />,
            matchPaths: ["/athlete/throws/readiness"],
          },
        ],
      },
      {
        label: "Team",
        href: "/athlete/team",
        icon: <Users {...iconSize} />,
        matchPaths: ["/athlete/team"],
      },
      {
        label: "Team Hub",
        href: "/athlete/hub",
        icon: <LayoutDashboard {...iconSize} />,
        matchPaths: ["/athlete/hub"],
      },
      {
        label: "Availability",
        href: "/athlete/availability",
        icon: <Calendar {...iconSize} />,
        matchPaths: ["/athlete/availability"],
      },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Wellness Check-in", href: "/athlete/wellness", icon: <Heart {...iconSize} /> },
    ],
  },
  {
    title: "My Profile",
    items: [
      { label: "Notifications", href: "/athlete/notifications", icon: <Bell {...iconSize} /> },
      { label: "Profile", href: "/athlete/profile", icon: <UserCircle {...iconSize} /> },
      { label: "Settings", href: "/athlete/settings", icon: <Settings {...iconSize} /> },
    ],
  },
];
