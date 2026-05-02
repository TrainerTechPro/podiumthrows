import Link from "next/link";

export const metadata = {
  title: "Account deleted · Podium Throws",
};

export default function GoodbyePage() {
  return (
    <div className="card p-8 space-y-6 text-center">
      <h2 className="text-xl font-heading text-[var(--foreground)]">
        Your account is scheduled for deletion
      </h2>
      <p className="text-sm text-muted">
        Everything we&apos;ve stored about you will be permanently removed in 30 days. Until then,
        you can sign back in and choose to restore — no data lost.
      </p>
      <p className="text-sm text-muted">
        Changed your mind?{" "}
        <Link href="/login" className="text-primary-500 hover:underline">
          Sign back in to restore
        </Link>
        .
      </p>
      <p className="text-xs text-muted">
        Need a hand? Email{" "}
        <a href="mailto:hello@podiumthrows.com" className="text-primary-500 hover:underline">
          hello@podiumthrows.com
        </a>
        .
      </p>
    </div>
  );
}
