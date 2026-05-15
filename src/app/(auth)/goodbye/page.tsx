import Link from "next/link";

export const metadata = {
  title: "Account deleted · Podium Throws",
};

export default function GoodbyePage() {
  return (
    <div className="card p-8 space-y-5 text-center">
      <h2 className="text-xl font-heading text-[var(--foreground)]">
        Your account is scheduled for deletion
      </h2>
      <p className="text-sm text-muted">
        You have 30 days to change your mind. After that, the following will be permanently removed:
      </p>
      <ul className="text-sm text-muted text-left mx-auto inline-block space-y-1 list-disc pl-5">
        <li>Your roster and athlete profiles</li>
        <li>Training programs, sessions, and throw logs</li>
        <li>Video analyses and uploaded clips</li>
        <li>PRs, readiness check-ins, and questionnaire responses</li>
      </ul>
      <p className="text-sm text-muted">
        Changed your mind?{" "}
        <Link href="/login" className="text-primary-500 hover:underline">
          Sign back in to restore — no data lost.
        </Link>
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
