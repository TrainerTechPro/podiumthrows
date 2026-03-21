"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#methodology", label: "Methodology" },
  { href: "/pricing", label: "Pricing" },
];

export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const rafRef = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isOnPricing = pathname === "/pricing";

  return (
    <>
      {/* Floating pill nav */}
      <div className="fixed top-[14px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[780px]">
        <header
          className={`rounded-[14px] border border-white/[0.06] transition-all duration-300 ${
            scrolled
              ? "bg-[var(--landing-surface)]/80 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
              : "bg-[var(--landing-surface)]/65 backdrop-blur-xl shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
          }`}
        >
          <div className="h-[46px] flex items-center justify-between px-3 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-primary-500 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <span className="font-heading font-bold text-[13px] text-surface-950 leading-none">P</span>
              </div>
              <span className="font-heading font-bold text-[14px] text-white group-hover:text-primary-400 transition-colors tracking-tight">
                Podium Throws
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-body text-[13px] transition-colors hover:text-white ${
                    link.href === "/pricing" && isOnPricing
                      ? "text-white"
                      : "text-surface-400 hover:text-surface-200"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-1.5">
              <Link
                href="/login"
                className="font-body text-[13px] text-surface-400 hover:text-white transition-colors px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-white text-surface-950 text-[13px] px-4 py-1.5 rounded-lg font-heading font-bold hover:bg-surface-100 transition-colors"
              >
                Start Free
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden p-2 text-surface-400 hover:text-white transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Mobile menu — dropdown inside the pill */}
          {menuOpen && (
            <div className="md:hidden border-t border-white/[0.06] px-4 pt-3 pb-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-body text-[14px] text-surface-400 hover:text-white transition-colors py-2.5 border-b border-white/[0.04] last:border-0"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-3">
                <Link
                  href="/login"
                  className="font-body text-center text-[14px] text-surface-400 py-2.5 border border-white/[0.08] rounded-lg hover:text-white hover:border-white/[0.16] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-white text-surface-950 text-center text-[14px] py-2.5 rounded-lg font-heading font-bold hover:bg-surface-100 transition-colors"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          )}
        </header>
      </div>
    </>
  );
}
