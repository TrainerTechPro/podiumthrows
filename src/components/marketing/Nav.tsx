"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
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
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-surface-950/95 backdrop-blur-md border-b border-surface-800"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[66px] flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <Image
            src="/logo.png"
            alt="Podium Throws"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="font-heading font-bold text-[16px] text-white group-hover:text-primary-400 transition-colors tracking-tight">
            Podium Throws
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-body text-sm transition-colors hover:text-white ${
                link.href === "/pricing" && isOnPricing
                  ? "text-white"
                  : "text-surface-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            href="/login"
            className="font-body text-sm text-surface-400 hover:text-white transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-primary-500 text-surface-950 text-sm px-5 py-2 font-heading font-bold hover:bg-primary-400 transition-colors"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-3 text-surface-400 hover:text-white transition-colors"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.5} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface-950 border-t border-surface-800 px-6 pt-4 pb-6 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-surface-400 hover:text-white transition-colors py-3 border-b border-surface-900 last:border-0"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-4">
            <Link
              href="/login"
              className="font-body text-center text-surface-400 py-3 border border-surface-800 hover:text-white hover:border-surface-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-primary-500 text-surface-950 text-center py-3 font-heading font-bold hover:bg-primary-400 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
