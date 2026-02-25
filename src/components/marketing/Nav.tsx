"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function ThrowingCircle({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <circle cx="18" cy="18" r="16" stroke="#f59e0b" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx="18" cy="18" r="4.5" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="1.75" fill="#f59e0b" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[18px] h-[18px]" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <path d="M4 12h16M4 6h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/pricing", label: "Pricing" },
];

export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    const val = next ? "dark" : "light";
    localStorage.setItem("theme", val);
    // Also set cookie so SSR picks it up on next request
    document.cookie = `theme=${val}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }

  const isOnPricing = pathname === "/pricing";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/95 dark:bg-surface-950/95 backdrop-blur-md border-b border-surface-200 dark:border-surface-800 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 h-[66px] flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <ThrowingCircle />
          <span className="font-heading font-bold text-[17px] text-surface-900 dark:text-white group-hover:text-primary-500 transition-colors">
            Podium Throws
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-body text-sm font-medium transition-colors hover:text-primary-500 ${
                (link.href === "/pricing" && isOnPricing) ||
                (link.href !== "/pricing" && pathname === "/" && false)
                  ? "text-primary-500"
                  : "text-surface-600 dark:text-surface-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link
            href="/login"
            className="font-body text-sm font-medium text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white transition-colors px-3 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="btn-primary text-sm px-4 py-2 rounded-lg font-semibold shadow-sm"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 px-5 pt-3 pb-5 flex flex-col gap-1 shadow-lg">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body font-medium text-surface-700 dark:text-surface-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors py-2.5 border-b border-surface-100 dark:border-surface-800 last:border-0"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-3">
            <Link
              href="/login"
              className="font-body font-medium text-center text-surface-700 dark:text-surface-300 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-surface-400 dark:hover:border-surface-500 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="btn-primary text-center py-2.5 rounded-xl font-semibold"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
