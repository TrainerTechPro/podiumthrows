import Link from "next/link";

const FOOTER_COLS = [
  {
    heading: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#methodology", label: "Bondarchuk Methodology" },
      { href: "/pricing", label: "Pricing" },
      { href: "/register", label: "Start Free Trial" },
    ],
  },
  {
    heading: "Events",
    links: [
      { href: "/#shot-put", label: "Shot Put" },
      { href: "/#discus", label: "Discus" },
      { href: "/#hammer", label: "Hammer Throw" },
      { href: "/#javelin", label: "Javelin" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/login", label: "Sign In" },
      { href: "/register", label: "Get Started" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="bg-[var(--landing-bg)] text-[var(--landing-text-dim)] border-t border-[var(--landing-border)]">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-10 sm:pt-16 pb-8">
        {/* Top grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 sm:gap-10 mb-10 sm:mb-16">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 group mb-5">
              <div className="w-5 h-5 bg-primary-500 rounded flex-shrink-0 grid place-items-center" style={{ borderRadius: 4 }}>
                <span className="font-heading font-bold text-[10px] text-surface-950">P</span>
              </div>
              <span className="font-heading font-bold text-base text-white group-hover:text-primary-400 transition-colors">
                Podium Throws
              </span>
            </Link>
            <p className="text-sm text-[var(--landing-text-dim)] leading-relaxed max-w-[220px]">
              The coaching platform built for throws. Rooted in Bondarchuk methodology.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h3 className="font-heading font-semibold text-[var(--landing-text-muted)] text-xs uppercase tracking-widest mb-4">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--landing-text-dim)] hover:text-[var(--landing-text-secondary)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[var(--landing-border)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-[var(--landing-text-dim)]">
            © {new Date().getFullYear()} Podium Throws. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-[var(--landing-text-dim)]">
            <span>Methodology: Dr. Anatoliy Bondarchuk</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
