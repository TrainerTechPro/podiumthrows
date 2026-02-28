"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

function ThrowingCircle({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <circle cx="18" cy="18" r="16" stroke="#f59e0b" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx="18" cy="18" r="4.5" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="1.75" fill="#f59e0b" />
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
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isOnPricing = pathname === "/pricing";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0d0c09]/95 backdrop-blur-md border-b border-[#2a2720]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-[66px] flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <ThrowingCircle />
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
                  : "text-[#8a8278]"
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
            className="font-body text-sm text-[#8a8278] hover:text-white transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-primary-500 text-[#0d0c09] text-sm px-5 py-2 font-heading font-bold hover:bg-primary-400 transition-colors"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-3 text-[#8a8278] hover:text-white transition-colors"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.5} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0d0c09] border-t border-[#2a2720] px-6 pt-4 pb-6 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-[#8a8278] hover:text-white transition-colors py-3 border-b border-[#1a1814] last:border-0"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-4">
            <Link
              href="/login"
              className="font-body text-center text-[#8a8278] py-3 border border-[#2a2720] hover:text-white hover:border-[#3a3730] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-primary-500 text-[#0d0c09] text-center py-3 font-heading font-bold hover:bg-primary-400 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
