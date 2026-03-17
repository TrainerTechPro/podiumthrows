"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";

export default function MfaLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mfaSessionToken = searchParams.get("token") || "";
  const redirect = searchParams.get("redirect");

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first digit on mount
  useEffect(() => {
    if (!backupMode) inputRefs.current[0]?.focus();
  }, [backupMode]);

  // Redirect to login if no token
  useEffect(() => {
    if (!mfaSessionToken) router.replace("/login");
  }, [mfaSessionToken, router]);

  function handleDigitChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    setError("");

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newDigits.every((d) => d.length === 1)) {
      submitTotp(newDigits.join(""));
    }
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split("");
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      submitTotp(pasted);
    }
  }

  async function submitTotp(token: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mfaSessionToken, token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      router.push(redirect || data.redirectTo || "/coach/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function submitBackup(e: FormEvent) {
    e.preventDefault();
    if (!backupCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mfaSessionToken, code: backupCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid backup code");
        setLoading(false);
        return;
      }

      router.push(redirect || data.redirectTo || "/coach/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="card p-8 max-w-md mx-auto">
      <h2 className="text-display-sm text-center mb-2">
        Two-Factor Authentication
      </h2>
      <p className="text-muted text-center text-sm mb-6">
        {backupMode
          ? "Enter one of your backup codes"
          : "Enter the 6-digit code from your authenticator app"}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
          {error}
        </div>
      )}

      {!backupMode ? (
        <>
          {/* 6-digit TOTP input */}
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className="w-12 h-14 text-center text-xl font-mono input"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setBackupMode(true);
              setError("");
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline block mx-auto mb-4"
          >
            Use a backup code instead
          </button>
        </>
      ) : (
        <>
          {/* Backup code input */}
          <form onSubmit={submitBackup} className="space-y-4 mb-4">
            <input
              type="text"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.toUpperCase());
                setError("");
              }}
              className="input text-center font-mono tracking-widest"
              placeholder="XXXX XXXX"
              autoFocus
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !backupCode.trim()}
              className="btn-primary w-full"
            >
              {loading ? "Verifying..." : "Verify Backup Code"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setBackupMode(false);
              setBackupCode("");
              setError("");
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline block mx-auto mb-4"
          >
            Use authenticator app instead
          </button>
        </>
      )}

      <Link
        href="/login"
        className="text-sm text-muted hover:text-foreground block text-center"
      >
        Back to login
      </Link>
    </div>
  );
}
