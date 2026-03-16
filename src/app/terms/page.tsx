import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400; // ISR: regenerate daily

export const metadata: Metadata = {
  title: "Terms of Service — Podium Throws",
};

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-sm text-muted">Last updated: March 1, 2026</p>
        </header>

        <div className="prose-custom space-y-6 text-sm text-[var(--foreground)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              1. Service Description
            </h2>
            <p className="text-muted">
              Podium Throws is a subscription-based coaching platform for track
              &amp; field throws coaches. The platform provides athlete roster
              management, training session planning, performance tracking, video
              analysis, and communication tools.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              2. Accounts &amp; Eligibility
            </h2>
            <p className="text-muted">
              You must provide a valid email address and maintain the security of
              your account credentials. Coach accounts require a subscription for
              access to paid features. Athlete accounts are created via coach
              invitations and are linked to the inviting coach&apos;s roster.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              3. Subscription &amp; Billing
            </h2>
            <p className="text-muted">
              Paid plans (Pro, Elite) are billed monthly through Stripe.
              Subscriptions renew automatically unless canceled. Downgrading to
              the Free plan limits your active athlete roster. You may cancel at
              any time; access continues through the end of the current billing
              period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              4. Acceptable Use
            </h2>
            <p className="text-muted">
              You agree not to: reverse-engineer the platform, use it for
              unlawful purposes, share account credentials, upload malicious
              content, or attempt to access other users&apos; data without
              authorization. We reserve the right to suspend accounts that
              violate these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              5. Data Ownership
            </h2>
            <p className="text-muted">
              Coaches retain full ownership of all training data, session logs,
              athlete information, and video content they upload to the platform.
              We do not claim any intellectual property rights over your content.
              You grant us a limited license to store and display your data
              solely for the purpose of operating the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              6. Limitation of Liability
            </h2>
            <p className="text-muted">
              Podium Throws is provided &ldquo;as is&rdquo; without warranties
              of any kind. We are not liable for training outcomes, injuries, or
              any damages resulting from use of the platform. Our total liability
              is limited to the amount you paid for the service in the preceding
              12 months.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              7. Termination
            </h2>
            <p className="text-muted">
              Either party may terminate at any time. Upon termination, you may
              request an export of your data within 30 days. After that period,
              we may delete your data in accordance with our retention policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              8. Changes to Terms
            </h2>
            <p className="text-muted">
              We may update these terms from time to time. Material changes will
              be communicated via email to registered account holders. Continued
              use of the platform after changes constitutes acceptance of the
              updated terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">
              9. Contact
            </h2>
            <p className="text-muted">
              For questions about these terms, contact us at{" "}
              <a
                href="mailto:legal@podiumthrows.com"
                className="text-primary-500 hover:text-primary-400 transition-colors"
              >
                legal@podiumthrows.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
