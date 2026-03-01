import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Podium Throws",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 py-16 px-4">
      <article className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link
            href="/"
            className="text-sm text-primary-500 hover:text-primary-400 transition-colors"
          >
            &larr; Back to Home
          </Link>
          <h1 className="text-display-sm font-heading text-[var(--foreground)]">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted">Last updated: March 1, 2026</p>
        </header>

        <div className="prose-custom space-y-6 text-sm text-[var(--foreground)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              1. Information We Collect
            </h2>
            <p className="text-muted">
              <strong className="text-[var(--foreground)]">Account Data:</strong>{" "}
              Name, email address, and encrypted password when you create an
              account.
            </p>
            <p className="text-muted">
              <strong className="text-[var(--foreground)]">Training Data:</strong>{" "}
              Athlete profiles, session logs, performance metrics, readiness
              check-ins, and coaching notes entered by coaches and athletes.
            </p>
            <p className="text-muted">
              <strong className="text-[var(--foreground)]">Video Uploads:</strong>{" "}
              Training and competition videos uploaded for analysis.
            </p>
            <p className="text-muted">
              <strong className="text-[var(--foreground)]">Usage Data:</strong>{" "}
              Page views and feature usage to improve the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              2. How We Use Your Data
            </h2>
            <p className="text-muted">
              We use your data solely to operate the Podium Throws coaching
              platform — delivering training management, performance tracking,
              and video analysis features. We do not sell or share your personal
              data for advertising purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              3. Data Storage &amp; Security
            </h2>
            <p className="text-muted">
              Account and training data are stored in a PostgreSQL database
              hosted by Vercel. Video files are stored on Cloudflare R2 object
              storage. All data is encrypted in transit via TLS. Passwords are
              hashed using bcrypt with industry-standard salt rounds.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              4. Cookies
            </h2>
            <p className="text-muted">
              We use a minimal set of cookies:{" "}
              <code className="text-xs bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
                auth-token
              </code>{" "}
              for authentication and{" "}
              <code className="text-xs bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
                theme
              </code>{" "}
              for your display preference. No third-party tracking cookies are
              used.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              5. Third-Party Services
            </h2>
            <p className="text-muted">
              <strong className="text-[var(--foreground)]">Stripe</strong> —
              processes subscription payments. Stripe&apos;s privacy policy
              governs payment data.
            </p>
            <p className="text-muted">
              <strong className="text-[var(--foreground)]">Resend</strong> —
              sends transactional emails (invitations, password resets).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              6. Data Ownership &amp; Deletion
            </h2>
            <p className="text-muted">
              Coaches own all training data they create. You may request a full
              export or deletion of your data at any time by contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              7. Contact
            </h2>
            <p className="text-muted">
              For privacy-related questions, contact us at{" "}
              <a
                href="mailto:privacy@podiumthrows.com"
                className="text-primary-500 hover:text-primary-400 transition-colors"
              >
                privacy@podiumthrows.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
