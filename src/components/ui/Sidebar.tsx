"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Target,
  Zap,
  FileText,
  Dumbbell,
  Video,
  Heart,
  ClipboardList,
  Crosshair,
  Mail,
  Settings,
  Award,
  Bell,
  BookOpen,
  PenLine,
  Radio,
  Wrench,
  UserCircle,
  ListChecks,
  Clapperboard,
  BarChart3,
} from "lucide-react";

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
        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 group",
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
            ? "text-primary-600 dark:text-primary-400 icon-active"
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
                <p className="px-3 mb-1.5 text-sm font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
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

/* ─── Shared icon props for consistent sizing ─────────────────────────── */

const iconSize = { size: 20, strokeWidth: 1.75, "aria-hidden": true as const };

/* ─── Pre-built nav configs ─────────────────────────────────────────────── */

export const COACH_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/coach/dashboard", icon: <LayoutDashboard {...iconSize} /> },
      { label: "Athletes", href: "/coach/athletes", icon: <Users {...iconSize} />, matchPaths: ["/coach/athletes"] },
      { label: "Sessions", href: "/coach/sessions", icon: <Calendar {...iconSize} />, matchPaths: ["/coach/sessions"] },
      { label: "Athlete Logs", href: "/coach/athlete-logs", icon: <PenLine {...iconSize} /> },
    ],
  },
  {
    title: "Throws",
    items: [
      { label: "Throws Dashboard", href: "/coach/throws", icon: <Target {...iconSize} /> },
      { label: "Roster", href: "/coach/throws/roster", icon: <Users {...iconSize} /> },
      { label: "Live Practice", href: "/coach/throws/practice", icon: <Radio {...iconSize} />, matchPaths: ["/coach/throws/practice"] },
      { label: "Build Program", href: "/coach/throws/program-builder", icon: <Zap {...iconSize} /> },
      { label: "Session Builder", href: "/coach/throws/builder", icon: <FileText {...iconSize} /> },
      { label: "Video Analysis", href: "/coach/throws/analyze", icon: <Clapperboard {...iconSize} />, matchPaths: ["/coach/throws/analyze"] },
      { label: "Drills", href: "/coach/throws/drills", icon: <ListChecks {...iconSize} /> },
      { label: "Throws Codex", href: "/coach/codex", icon: <BookOpen {...iconSize} /> },
    ],
  },
  {
    title: "Programs",
    items: [
      { label: "Workout Plans", href: "/coach/plans", icon: <FileText {...iconSize} /> },
      { label: "Exercises", href: "/coach/exercises", icon: <Dumbbell {...iconSize} /> },
      { label: "Video Library", href: "/coach/videos", icon: <Video {...iconSize} />, matchPaths: ["/coach/videos"] },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Wellness", href: "/coach/wellness", icon: <Heart {...iconSize} /> },
      { label: "Questionnaires", href: "/coach/questionnaires", icon: <ClipboardList {...iconSize} />, matchPaths: ["/coach/questionnaires"] },
      { label: "Goals", href: "/coach/goals", icon: <Crosshair {...iconSize} /> },
      { label: "Tools", href: "/coach/tools", icon: <Wrench {...iconSize} /> },
    ],
  },
  {
    title: "My Training",
    items: [
      { label: "My Program", href: "/coach/my-program", icon: <Zap {...iconSize} />, matchPaths: ["/coach/my-program"] },
      { label: "Log Session", href: "/coach/log-session", icon: <PenLine {...iconSize} /> },
      { label: "My Training Log", href: "/coach/my-training", icon: <Target {...iconSize} /> },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Notifications", href: "/coach/notifications", icon: <Bell {...iconSize} /> },
      { label: "Invitations", href: "/coach/invitations", icon: <Mail {...iconSize} /> },
      { label: "Settings", href: "/coach/settings", icon: <Settings {...iconSize} />, matchPaths: ["/coach/settings"] },
    ],
  },
];

export const ATHLETE_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "My Dashboard", href: "/athlete/dashboard", icon: <LayoutDashboard {...iconSize} /> },
      { label: "Log Session", href: "/athlete/log-session", icon: <PenLine {...iconSize} /> },
      { label: "My Sessions", href: "/athlete/sessions", icon: <Calendar {...iconSize} />, matchPaths: ["/athlete/sessions"] },
      { label: "Throw History", href: "/athlete/throws", icon: <Target {...iconSize} />, matchPaths: ["/athlete/throws"] },
      { label: "Throws Codex", href: "/athlete/codex", icon: <BookOpen {...iconSize} /> },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Wellness Check-in", href: "/athlete/wellness", icon: <Heart {...iconSize} /> },
      { label: "Assessments", href: "/athlete/assessments", icon: <BarChart3 {...iconSize} /> },
      { label: "Questionnaires", href: "/athlete/questionnaires", icon: <ClipboardList {...iconSize} />, matchPaths: ["/athlete/questionnaires"] },
      { label: "My Videos", href: "/athlete/videos", icon: <Video {...iconSize} />, matchPaths: ["/athlete/videos"] },
      { label: "Tools", href: "/athlete/tools", icon: <Wrench {...iconSize} /> },
    ],
  },
  {
    title: "My Profile",
    items: [
      { label: "Profile", href: "/athlete/profile", icon: <UserCircle {...iconSize} /> },
      { label: "Goals", href: "/athlete/goals", icon: <Crosshair {...iconSize} /> },
      { label: "Achievements", href: "/athlete/achievements", icon: <Award {...iconSize} /> },
      { label: "Settings", href: "/athlete/settings", icon: <Settings {...iconSize} /> },
    ],
  },
];
