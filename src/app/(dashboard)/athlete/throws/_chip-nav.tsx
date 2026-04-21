"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── Throws Tab — Chip Nav ──────────────────────────────────────────────────
   Mounts at the top of every page that lives inside the Throws tab's
   matchPaths (Hub, Trends, History, PRs, Competitions, Readiness). The
   active chip is derived from pathname — keep the chips themselves
   href-only, no onClick routing. Horizontal scroll on narrow viewports
   (consumer-app thumb pattern). See tasks/nav-ia-v2.md §2.3.
   ──────────────────────────────────────────────────────────────────── */

type Chip = {
  label: string;
  href: string;
  /** Additional pathnames that should highlight this chip. Matched by
   *  equality OR startsWith("/" + path). */
  matchPaths?: string[];
};

const CHIPS: Chip[] = [
  { label: "Hub", href: "/athlete/throws", matchPaths: ["/athlete/throws"] },
  {
    label: "Trends",
    href: "/athlete/throws/trends",
    matchPaths: ["/athlete/throws/trends"],
  },
  {
    label: "History",
    href: "/athlete/throws/history",
    matchPaths: ["/athlete/throws/history", "/athlete/throws/session", "/athlete/throws/live"],
  },
  {
    label: "PRs",
    href: "/athlete/achievements",
    matchPaths: ["/athlete/achievements"],
  },
  {
    label: "Competitions",
    href: "/athlete/competitions",
    matchPaths: ["/athlete/competitions"],
  },
  {
    label: "Readiness",
    href: "/athlete/throws/readiness",
    matchPaths: ["/athlete/throws/readiness", "/athlete/throws/quiz"],
  },
];

function isActive(pathname: string, chip: Chip): boolean {
  // "Hub" is the bare /athlete/throws — match equality only, not subtrees.
  if (chip.href === "/athlete/throws") {
    return pathname === "/athlete/throws";
  }
  return !!chip.matchPaths?.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function ThrowsChipNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Throws sections"
      className="flex gap-2 overflow-x-auto custom-scrollbar -mx-4 px-4 pb-1"
    >
      {CHIPS.map((chip) => {
        const active = isActive(pathname, chip);
        return (
          <Link
            key={chip.href}
            href={chip.href}
            aria-current={active ? "page" : undefined}
            className={
              "shrink-0 inline-flex items-center px-3.5 rounded-full text-xs font-semibold transition-colors min-h-[32px] " +
              (active
                ? "bg-[var(--color-brand)] text-[var(--color-text-on-brand)]"
                : "bg-[var(--color-bg-surface-sunken)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")
            }
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}
