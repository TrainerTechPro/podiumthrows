/**
 * Visually hidden until keyboard-focused. First Tab from any layout lands here
 * and lets a keyboard or screen-reader user jump past the persistent nav
 * straight to page content. WCAG 2.4.1 (Bypass Blocks).
 *
 * The target id is `main-content` and is set on the `<main>` element in
 * DashboardLayout (both shells) and the auth layout. Keep them aligned —
 * if you rename the target, update both ends.
 */

interface Props {
  /** Defaults to `#main-content`. */
  href?: string;
  children?: React.ReactNode;
}

export function SkipLink({ href = "#main-content", children = "Skip to main content" }: Props) {
  return (
    <a
      href={href}
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-3 focus:left-3 focus:z-[100]
        focus:px-4 focus:py-2 focus:rounded-lg
        focus:bg-primary-500 focus:text-surface-950 focus:font-semibold focus:text-sm
        focus:shadow-lg
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]
      "
    >
      {children}
    </a>
  );
}
