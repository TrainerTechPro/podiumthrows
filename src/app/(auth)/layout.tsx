import Link from "next/link";
import { SkipLink } from "@/components/ui/SkipLink";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-950 px-4 py-12">
      <SkipLink />
      <main id="main-content" className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-display-md text-primary-500 font-heading">Podium Throws</h1>
        </div>
        {children}
      </main>
      {/* Legal links on every auth surface (login, register, password reset) —
          disclosure must be reachable wherever we collect personal data. */}
      <footer className="w-full max-w-md mt-8 text-center text-caption text-muted">
        <Link href="/privacy" className="hover:text-[var(--foreground)] hover:underline">
          Privacy Policy
        </Link>
        <span className="mx-2" aria-hidden="true">
          ·
        </span>
        <Link href="/terms" className="hover:text-[var(--foreground)] hover:underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
