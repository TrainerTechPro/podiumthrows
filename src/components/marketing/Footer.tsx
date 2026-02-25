import Link from "next/link";

function ThrowingCircle() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 flex-shrink-0" aria-hidden="true">
      <circle cx="18" cy="18" r="16" stroke="#f59e0b" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx="18" cy="18" r="4.5" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="1.75" fill="#f59e0b" />
    </svg>
  );
}

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
    <footer className="bg-surface-950 text-surface-400 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-16 pb-8">
        {/* Top grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-10 mb-16">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 group mb-5">
              <ThrowingCircle />
              <span className="font-heading font-bold text-base text-white group-hover:text-primary-400 transition-colors">
                Podium Throws
              </span>
            </Link>
            <p className="text-sm text-surface-500 leading-relaxed max-w-[220px]">
              Elite coaching platform for shot put, discus, hammer, and javelin coaches at every level.
            </p>
            <p className="mt-5 text-xs text-surface-700 font-medium uppercase tracking-widest">
              Built on Bondarchuk Transfer of Training
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h3 className="font-heading font-semibold text-white text-xs uppercase tracking-widest mb-4">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-surface-500 hover:text-primary-400 transition-colors"
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
        <div className="pt-8 border-t border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-surface-600">
            © {new Date().getFullYear()} Podium Throws. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-surface-700">
            <span>Methodology rooted in Dr. Anatoliy Bondarchuk's research</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
