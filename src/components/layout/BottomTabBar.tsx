"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, PlusCircle, Activity, UserCircle } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";

/* ─── Bottom Tab Bar ─────────────────────────────────────────────────────────
   The athlete app is mobile-primary. This is its navigation — five
   tabs, task-oriented, thumb-zone. Desktop athletes get the same bar
   (Instagram/Twitter-web pattern) — we're committing to the native
   paradigm rather than pretending athletes want a desktop sidebar.

   The center "Log" action is the canonical entry point for logging a
   throwing session. It stays in the same rail as the other tabs so the
   mobile shell does not grow a floating bumper at the bottom edge.

   Everything not in these five tabs lives inside the tabs: roster and
   self-program under Training; history, trends, PRs, competitions,
   readiness, and achievements under Throws; wellness check-in under Home
   (it gates today's training decision, not a profile setting); notifications,
   settings, and profile under Profile. /athlete/availability and
   /athlete/integrations are deep-link only with no tab highlight. If a
   surface can't be reached from these five tabs (directly or via deep
   link), it shouldn't be a standalone page.
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
    // Wellness is reached from Home's readiness ring — it's a Home-tab flow,
    // not a settings page. Highlight Home when the athlete is checking in.
    matchPaths: ["/athlete/dashboard", "/athlete/wellness"],
  },
  {
    href: "/athlete/sessions",
    label: "Training",
    icon: Calendar,
    matchPaths: ["/athlete/sessions", "/athlete/self-program"],
  },
  {
    href: "/athlete/log-session",
    label: "Log",
    icon: PlusCircle,
    primary: true,
    // /athlete/throws/log is reachable from Sidebar, QuickActions, and history
    // edit links (it's the only edit path for self-logged sessions). The active
    // tab there belongs to Throws (its parent subtree) — see tasks/nav-ia-v2.md
    // §3. The bottom-tab Log button uses /athlete/log-session for new sessions.
    matchPaths: ["/athlete/log-session", "/athlete/quick-start"],
  },
  {
    href: "/athlete/throws",
    label: "Throws",
    icon: Activity,
    // Analytics-only surface. Readiness/quiz are deep-link survivors but no
    // longer primary IA — they live under Wellness (Home) for new entries.
    matchPaths: [
      "/athlete/throws",
      "/athlete/throws/trends",
      "/athlete/throws/history",
      "/athlete/throws/readiness",
      "/athlete/throws/quiz",
      "/athlete/throws/session",
      "/athlete/throws/live",
      "/athlete/achievements",
      "/athlete/competitions",
    ],
  },
  {
    href: "/athlete/profile",
    label: "Profile",
    icon: UserCircle,
    // Profile + account/settings only. Wellness moved to Home tab (canonical
    // entry is the readiness ring). Availability + integrations remain
    // deep-link-only (coach calendar, wearable banners) and still highlight
    // Profile for context — they're settings-shape pages.
    matchPaths: [
      "/athlete/profile",
      "/athlete/settings",
      "/athlete/notifications",
      "/athlete/availability",
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
  const haptic = useHaptic();

  return (
    <nav
      className={cn(
        "shrink-0 w-full z-30",
        "bg-[var(--color-bg-surface)] border-t border-[var(--color-border-default)]",
        "flex items-stretch justify-around",
        "min-h-16"
      )}
      style={{
        height: "calc(4rem + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        const active = isTabActive(tab, pathname);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={tab.primary ? () => haptic.medium() : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5",
              "flex-1 min-h-[44px] px-1",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg",
              active
                ? "text-[var(--foreground)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--foreground)]"
            )}
          >
            {tab.primary ? (
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full",
                  active
                    ? "bg-primary-500 text-surface-950"
                    : "bg-primary-500/12 text-primary-600 dark:text-primary-400",
                  "transition-[background-color,color,transform] duration-150 active:scale-95"
                )}
                aria-hidden="true"
              >
                <Icon size={22} strokeWidth={2} />
              </span>
            ) : (
              <Icon
                size={22}
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden="true"
                className={cn(
                  "transition-colors duration-150",
                  active && "text-primary-600 dark:text-primary-400"
                )}
              />
            )}
            <span
              className={cn(
                "text-nano leading-none tracking-wide",
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
