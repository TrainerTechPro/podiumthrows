import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4">
      <div className="max-w-md w-full text-center space-y-5">
        {/* 404 badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/10 mx-auto">
          <span className="text-2xl font-bold font-heading text-primary-500">
            404
          </span>
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">
            Page Not Found
          </h1>
          <p className="text-sm text-muted">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--card-border)] text-sm font-medium text-[var(--foreground)] hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
