"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
  /** Items that also count as "active" for this link */
  matchPaths?: string[];
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

function SidebarNavItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    pathname.startsWith(item.href + "/") ||
    item.matchPaths?.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
        isActive
          ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
          : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Icon */}
      <span
        className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          isActive
            ? "text-primary-600 dark:text-primary-400"
            : "text-surface-400 dark:text-surface-500 group-hover:text-surface-600 dark:group-hover:text-surface-300"
        )}
      >
        {item.icon}
      </span>

      {/* Label */}
      <span className="flex-1 truncate">{item.label}</span>

      {/* Badge */}
      {item.badge !== undefined && (
        <span
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
            isActive
              ? "bg-primary-200 dark:bg-primary-500/30 text-primary-700 dark:text-primary-300"
              : "bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300"
          )}
        >
          {item.badge}
        </span>
      )}

      {/* Active indicator */}
      {isActive && (
        <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
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
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          /* Base */
          "fixed top-0 left-0 z-40 h-full w-[260px]",
          "flex flex-col bg-[var(--card-bg)] border-r border-[var(--card-border)]",
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
          <div className="px-4 py-4 border-b border-[var(--card-border)] shrink-0">
            {header}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-5">
          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
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
          <div className="px-4 py-4 border-t border-[var(--card-border)] shrink-0">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}

/* ─── Pre-built nav configs ─────────────────────────────────────────────── */

export const COACH_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/coach/dashboard",
        icon: <DashboardIcon />,
      },
      {
        label: "Athletes",
        href: "/coach/athletes",
        icon: <AthletesIcon />,
        matchPaths: ["/coach/athletes"],
      },
      {
        label: "Sessions",
        href: "/coach/sessions",
        icon: <SessionsIcon />,
      },
      {
        label: "Throw Logs",
        href: "/coach/throws",
        icon: <ThrowIcon />,
      },
      {
        label: "Drills",
        href: "/coach/throws/drills",
        icon: <ThrowIcon />,
      },
    ],
  },
  {
    title: "Programs",
    items: [
      {
        label: "Workout Plans",
        href: "/coach/plans",
        icon: <PlansIcon />,
      },
      {
        label: "Exercises",
        href: "/coach/exercises",
        icon: <ExerciseIcon />,
      },
      {
        label: "Video Library",
        href: "/coach/videos",
        icon: <VideoIcon />,
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Wellness",
        href: "/coach/wellness",
        icon: <WellnessIcon />,
      },
      {
        label: "Questionnaires",
        href: "/coach/questionnaires",
        icon: <QuestionnaireIcon />,
      },
      {
        label: "Goals",
        href: "/coach/goals",
        icon: <GoalIcon />,
      },
    ],
  },
  {
    title: "Alerts",
    items: [
      {
        label: "Notifications",
        href: "/coach/notifications",
        icon: <NotificationIcon />,
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        label: "Invitations",
        href: "/coach/invitations",
        icon: <InviteIcon />,
      },
      {
        label: "Settings",
        href: "/coach/settings",
        icon: <SettingsIcon />,
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
        icon: <DashboardIcon />,
      },
      {
        label: "My Sessions",
        href: "/athlete/sessions",
        icon: <SessionsIcon />,
      },
      {
        label: "Throw History",
        href: "/athlete/throws",
        icon: <ThrowIcon />,
      },
      {
        label: "Wellness Check-in",
        href: "/athlete/wellness",
        icon: <WellnessIcon />,
      },
      {
        label: "Questionnaires",
        href: "/athlete/questionnaires",
        icon: <QuestionnaireIcon />,
      },
      {
        label: "My Videos",
        href: "/athlete/videos",
        icon: <VideoIcon />,
      },
    ],
  },
  {
    title: "My Profile",
    items: [
      {
        label: "Goals",
        href: "/athlete/goals",
        icon: <GoalIcon />,
      },
      {
        label: "Achievements",
        href: "/athlete/achievements",
        icon: <AchievementIcon />,
      },
      {
        label: "Settings",
        href: "/athlete/settings",
        icon: <SettingsIcon />,
      },
    ],
  },
];

/* ─── Inline nav icons ───────────────────────────────────────────────────── */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function DashboardIcon()     { return <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>; }
function AthletesIcon()      { return <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function SessionsIcon()      { return <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function ThrowIcon()         { return <svg {...iconProps}><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>; }
function PlansIcon()         { return <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }
function ExerciseIcon()      { return <svg {...iconProps}><path d="M6.5 6.5h11M6.5 17.5h11M3 12h3M18 12h3M5 10v4M19 10v4"/></svg>; }
function VideoIcon()         { return <svg {...iconProps}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>; }
function WellnessIcon()      { return <svg {...iconProps}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }
function QuestionnaireIcon() { return <svg {...iconProps}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function GoalIcon()          { return <svg {...iconProps}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function InviteIcon()        { return <svg {...iconProps}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function SettingsIcon()      { return <svg {...iconProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function AchievementIcon()   { return <svg {...iconProps}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>; }
function NotificationIcon()  { return <svg {...iconProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
