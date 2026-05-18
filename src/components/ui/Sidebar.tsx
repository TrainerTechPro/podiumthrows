"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Target,
  Settings,
  CalendarRange,
  UserPlus,
  ChevronRight,
  Library,
  Wrench,
  Megaphone,
  Video,
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
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
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
                "px-1.5 py-0.5 rounded-full text-nano font-bold tabular-nums",
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
            aria-hidden="true"
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
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
            "ml-auto min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-nano font-bold tabular-nums shrink-0",
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

export function Sidebar({ sections, header, footer, open, onClose, className }: SidebarProps) {
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

        {/* Mode toggle lives in the header (DashboardLayout) — not rendered
            here to avoid two copies of the same control on desktop. */}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-5">
          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="px-3 mb-2 text-micro font-bold uppercase tracking-[0.15em] text-surface-400 dark:text-surface-500">
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

/**
 * Coach sidebar contract — Dashboard, Athletes, Calendar, Builder, Library,
 * (optional) Video, Settings. Anything else is a deep-link or feature-flagged
 * module. See tasks/navigation-contract-2026-05-18.md.
 *
 * Video is conditional: it appears only when the `videoAnalysis` flag is on,
 * because the underlying route is gated by middleware FLAG_GATED_ROUTES — a
 * sidebar entry that immediately redirects is worse than no entry. The coach
 * layout resolves the flag server-side and passes the result here.
 */
export function getCoachNavSections(
  { videoAnalysisEnabled }: { videoAnalysisEnabled: boolean } = { videoAnalysisEnabled: false }
): NavSection[] {
  const primary: NavItem[] = [
    {
      label: "Dashboard",
      href: "/coach/dashboard",
      icon: <LayoutDashboard {...iconSize} />,
      // /coach/wellness redirects to /coach/dashboard?tab=readiness — keep
      // the matchPath so a deep-link from a coach email still highlights
      // Dashboard during the redirect hop.
      matchPaths: ["/coach/dashboard", "/coach/wellness"],
    },

    // Athletes — Tier-1 (Roster, Self-Logs, Competitions) lives in the page
    // header. Tier-2 admin surfaces (Throws, Invitations, Groups, Event
    // Groups, Goals, Announcements) appear as sidebar children.
    {
      label: "Athletes",
      href: "/coach/athletes",
      icon: <Users {...iconSize} />,
      matchPaths: [
        "/coach/athletes",
        "/coach/invitations",
        "/coach/competitions",
        "/coach/team",
        "/coach/teams",
        "/coach/event-groups",
        "/coach/goals",
        "/coach/athlete-logs",
        "/coach/hub",
        "/coach/throws/assessment",
      ],
      children: [
        {
          label: "Roster",
          href: "/coach/athletes",
          icon: <Users {...iconSize} />,
          matchPaths: ["/coach/athletes"],
        },
        {
          label: "Throws",
          href: "/coach/athletes/throws",
          icon: <Target {...iconSize} />,
          matchPaths: ["/coach/athletes/throws"],
        },
        {
          label: "Invitations",
          href: "/coach/athletes/invitations",
          icon: <UserPlus {...iconSize} />,
          matchPaths: ["/coach/athletes/invitations", "/coach/invitations"],
        },
        {
          label: "Groups",
          href: "/coach/athletes/groups",
          icon: <UsersRound {...iconSize} />,
          matchPaths: ["/coach/athletes/groups", "/coach/teams"],
        },
        {
          label: "Event Groups",
          href: "/coach/athletes/event-groups",
          icon: <UsersRound {...iconSize} />,
          matchPaths: ["/coach/athletes/event-groups", "/coach/event-groups"],
        },
        {
          label: "Goals",
          href: "/coach/athletes/goals",
          icon: <Target {...iconSize} />,
          matchPaths: ["/coach/athletes/goals", "/coach/goals"],
        },
        {
          label: "Announcements",
          href: "/coach/athletes/announcements",
          icon: <Megaphone {...iconSize} />,
          matchPaths: ["/coach/athletes/announcements", "/coach/team"],
        },
      ],
    },

    // Calendar — absorbs schedule, practices, availability, live-practice.
    {
      label: "Calendar",
      href: "/coach/calendar",
      icon: <CalendarRange {...iconSize} />,
      matchPaths: [
        "/coach/calendar",
        "/coach/schedule",
        "/coach/practices",
        "/coach/availability",
        "/coach/throws/practice",
      ],
    },

    // Library — exercises, throws sessions, drills, plans, drill videos.
    {
      label: "Library",
      href: "/coach/library",
      icon: <Library {...iconSize} />,
      matchPaths: [
        "/coach/library",
        "/coach/exercises",
        "/coach/plans",
        "/coach/throws/library",
        "/coach/throws/drills",
        "/coach/videos/drills",
      ],
    },

    // Builder — session, plan (manual / generate), drill.
    {
      label: "Builder",
      href: "/coach/builder",
      icon: <Wrench {...iconSize} />,
      matchPaths: [
        "/coach/builder",
        "/coach/throws/builder",
        "/coach/plans/new",
        "/coach/plans/generate",
      ],
    },
  ];

  if (videoAnalysisEnabled) {
    primary.push({
      label: "Video",
      href: "/coach/video-analysis",
      icon: <Video {...iconSize} />,
      matchPaths: ["/coach/video-analysis", "/coach/videos", "/coach/throws/analyze"],
    });
  }

  return [
    { items: primary },
    {
      items: [
        // Notifications + Feedback Inbox live in the top bar. Settings
        // absorbs Tools (calculators) and Integrations as tabs.
        {
          label: "Settings",
          href: "/coach/settings",
          icon: <Settings {...iconSize} />,
          matchPaths: ["/coach/settings", "/coach/integrations", "/coach/tools"],
        },
      ],
    },
  ];
}

/**
 * Static default for callers that can't resolve flags (tests, command palette
 * fallback). Production uses {@link getCoachNavSections} from the coach layout.
 */
export const COACH_NAV_SECTIONS: NavSection[] = getCoachNavSections();

// ATHLETE_NAV_SECTIONS was removed 2026-05-18. The athlete shell is
// mobile-native (BottomTabBar) on every viewport — desktop is a roomy
// fallback, not a separate sidebar product. See
// tasks/navigation-contract-2026-05-18.md for the canonical contract.
