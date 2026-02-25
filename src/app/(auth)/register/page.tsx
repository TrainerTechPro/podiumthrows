"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "COACH" | "ATHLETE";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [step, setStep] = useState<"role" | "form">(inviteToken ? "form" : "role");
  const [role, setRole] = useState<Role>(inviteToken ? "ATHLETE" : "COACH");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectRole(selectedRole: Role) {
    setRole(selectedRole);
    setStep("form");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!firstName || !lastName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (role === "ATHLETE" && !inviteToken) {
      setError("Athletes must register via an invitation link from their coach.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          role,
          inviteToken: inviteToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (step === "role") {
    return (
      <div className="card p-8">
        <h2 className="text-display-sm text-center mb-2">Create Account</h2>
        <p className="text-center text-muted text-sm mb-8">
          Select how you&apos;ll use Podium Throws
        </p>

        <div className="space-y-3">
          <button
            onClick={() => selectRole("COACH")}
            className="w-full p-5 rounded-2xl border-2 border-surface-200 dark:border-surface-700 hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xl">
                🏋️
              </div>
              <div>
                <p className="font-heading font-semibold text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  I&apos;m a Coach
                </p>
                <p className="text-sm text-muted">
                  Manage athletes, plan training, track throws
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => selectRole("ATHLETE")}
            className="w-full p-5 rounded-2xl border-2 border-surface-200 dark:border-surface-700 hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-left group"
            disabled={!inviteToken}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xl">
                🥇
              </div>
              <div>
                <p className="font-heading font-semibold text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  I&apos;m an Athlete
                </p>
                <p className="text-sm text-muted">
                  {inviteToken
                    ? "Join your coach's training program"
                    : "Requires an invitation from your coach"}
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <div className="flex items-center gap-2 mb-6">
        {!inviteToken && (
          <button
            onClick={() => setStep("role")}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 className="text-display-sm">
          {role === "COACH" ? "Coach Registration" : "Athlete Registration"}
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="label">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input"
              placeholder="Marcus"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="label">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input"
              placeholder="Petrov"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Creating account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
