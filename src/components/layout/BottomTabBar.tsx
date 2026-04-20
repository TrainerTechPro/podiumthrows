"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, PlusCircle, BarChart3, UserCircle } from "lucide-react";

/* ─── Bottom Tab Bar ─────────────────────────────────────────────────────────
   The athlete app is mobile-primary. This is its navigation — five
   tabs, task-oriented, thumb-zone. Desktop athletes get the same bar
   (Instagram/Twitter-web pattern) — we're committing to the native
   paradigm rather than pretending athletes want a desktop sidebar.

   The center "Log" action is the canonical entry point for logging a
   throwing session. Elevating it visually enforces that everything
   else ladders up to that moment.

   Everything not in these five tabs lives inside the tabs: roster and
   team hub under Training, competitions and readiness under Trends,
   notifications/settings/wellness/availability under Me. If a surface
   can't be reached from these five, it shouldn't be a standalone page.
   ─────────────────────────────────────────────────────────────────────── */

interface Tab {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Additional paths that should render this tab as active */
  matchPaths?: string[];
  /** Center tab — elevated primary action */
  primary?: boolean;
}

const TABS: Tab[] = [
  {
    href: "/athlete/dashboard",
    label: "Home",
    icon: LayoutDashboard,
    matchPaths: ["/athlete/dashboard", "/athlete/hub"],
  },
  {
    href: "/athlete/sessions",
    label: "Training",
    icon: Calendar,
    matchPaths: ["/athlete/sessions", "/athlete/self-program"],
  },
  {
    href: "/athlete/throws/log",
    label: "Log",
    icon: PlusCircle,
    primary: true,
    matchPaths: ["/athlete/throws/log", "/athlete/log-session", "/athlete/quick-start"],
  },
  {
    href: "/athlete/throws/trends",
    label: "Trends",
    icon: BarChart3,
    matchPaths: [
      "/athlete/throws",
      "/athlete/throws/trends",
      "/athlete/throws/history",
      "/athlete/achievements",
      "/athlete/competitions",
    ],
  },
  {
    href: "/athlete/profile",
    label: "Me",
    icon: UserCircle,
    matchPaths: [
      "/athlete/profile",
      "/athlete/settings",
      "/athlete/notifications",
      "/athlete/wellness",
      "/athlete/availability",
      "/athlete/team",
      "/athlete/integrations",
    ],
  },
];

function isTabActive(tab: Tab, pathname: string): boolean {
  if (pathname === tab.href) return true;
  return !!tab.matchPaths?.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-30",
        "bg-[var(--color-bg-surface)] border-t border-[var(--color-border-default)]",
        "flex items-stretch justify-around",
        "h-16"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        const active = isTabActive(tab, pathname);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5",
              "flex-1 min-h-[44px] px-1",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg",
              tab.primary && "-mt-3",
              active
                ? "text-primary-500 dark:text-primary-400"
                : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
            )}
          >
            {tab.primary ? (
              <span
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-full",
                  "bg-primary-500 text-surface-950",
                  "shadow-[0_4px_14px_0_rgba(255,200,0,0.35)]",
                  "transition-transform duration-150 active:scale-95"
                )}
                aria-hidden="true"
              >
                <Icon size={24} strokeWidth={2} />
              </span>
            ) : (
              <Icon
                size={22}
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden="true"
                className="transition-all duration-150"
              />
            )}
            <span
              className={cn(
                "text-[10px] leading-none tracking-wide",
                tab.primary && "mt-1",
                active ? "font-semibold" : "font-medium"
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
