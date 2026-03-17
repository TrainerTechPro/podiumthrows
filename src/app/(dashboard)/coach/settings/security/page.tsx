"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/toast";

type Phase =
  | "loading"
  | "disabled"
  | "setup-qr"
  | "setup-verify"
  | "backup-codes"
  | "enabled";

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Setup state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [encryptedSecret, setEncryptedSecret] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setupCodeRef = useRef<HTMLInputElement>(null);

  // Fetch MFA status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/coach/profile");
        if (res.ok) {
          const data = await res.json();
          const enabled = data.profile?.mfaEnabled ?? false;
          setMfaEnabled(enabled);
          setPhase(enabled ? "enabled" : "disabled");
        } else {
          setPhase("disabled");
        }
      } catch {
        setPhase("disabled");
      }
    }
    fetchStatus();
  }, []);

  async function startSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { ...csrfHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start MFA setup");
        setLoading(false);
        return;
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setManualSecret(data.secret);
      setEncryptedSecret(data.encryptedSecret);
      setPhase("setup-qr");
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  async function verifySetup() {
    if (setupCode.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ token: setupCode, encryptedSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        setSetupCode("");
        setupCodeRef.current?.focus();
        setLoading(false);
        return;
      }
      setBackupCodes(data.backupCodes);
      setMfaEnabled(true);
      setPhase("backup-codes");
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  async function disableMfa() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          password: disablePassword,
          token: disableCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to disable MFA");
        setLoading(false);
        return;
      }
      setMfaEnabled(false);
      setShowDisableModal(false);
      setDisablePassword("");
      setDisableCode("");
      setPhase("disabled");
      setLoading(false);
      toast("Two-factor authentication disabled", "info");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      toast("Backup codes copied to clipboard", "success");
    });
  }

  if (phase === "loading") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-48" />
          <div className="h-32 bg-surface-200 dark:bg-surface-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/coach/settings"
          className="text-muted hover:text-foreground"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-display-sm">Security</h1>
      </div>

      {/* MFA Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold font-display">
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-muted mt-1">
              Add an extra layer of security with an authenticator app
            </p>
          </div>
          {mfaEnabled ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-success-500/10 text-success-600 dark:text-success-400 border border-success-500/20">
              Enabled
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-200 dark:bg-surface-700 text-muted">
              Disabled
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
            {error}
          </div>
        )}

        {/* Phase: Disabled */}
        {phase === "disabled" && (
          <button
            onClick={startSetup}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Setting up..." : "Enable Two-Factor Authentication"}
          </button>
        )}

        {/* Phase: QR Code Display */}
        {phase === "setup-qr" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Scan this QR code with your authenticator app (Google
              Authenticator, Authy, 1Password, etc.)
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeDataUrl}
                alt="MFA QR Code"
                className="w-48 h-48 rounded-lg bg-white p-2"
              />
            </div>
            <details className="text-sm">
              <summary className="text-primary-600 dark:text-primary-400 cursor-pointer">
                Can&apos;t scan? Enter this code manually
              </summary>
              <code className="block mt-2 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg font-mono text-sm break-all select-all">
                {manualSecret}
              </code>
            </details>
            <button
              onClick={() => {
                setPhase("setup-verify");
                setTimeout(() => setupCodeRef.current?.focus(), 100);
              }}
              className="btn-primary w-full"
            >
              I&apos;ve scanned the code
            </button>
          </div>
        )}

        {/* Phase: Verify Setup */}
        {phase === "setup-verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Enter the 6-digit code from your authenticator app to confirm
              setup
            </p>
            <div className="flex gap-2">
              <input
                ref={setupCodeRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={setupCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setSetupCode(v);
                  setError("");
                }}
                className="input font-mono text-center text-lg tracking-widest flex-1"
                placeholder="000000"
                autoFocus
              />
              <button
                onClick={verifySetup}
                disabled={loading || setupCode.length !== 6}
                className="btn-primary"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>
            <button
              onClick={() => {
                setPhase("setup-qr");
                setSetupCode("");
                setError("");
              }}
              className="text-sm text-muted hover:text-foreground"
            >
              Back to QR code
            </button>
          </div>
        )}

        {/* Phase: Backup Codes (one-time display) */}
        {phase === "backup-codes" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-500/20">
              <p className="text-sm font-medium text-warning-700 dark:text-warning-400">
                Save these backup codes in a safe place. Each code can only be
                used once. You won&apos;t be able to see them again.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
              {backupCodes.map((code, i) => (
                <code key={i} className="font-mono text-sm py-1">
                  {code}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={copyBackupCodes} className="btn-secondary flex-1">
                Copy codes
              </button>
              <button
                onClick={() => setPhase("enabled")}
                className="btn-primary flex-1"
              >
                I&apos;ve saved my codes
              </button>
            </div>
          </div>
        )}

        {/* Phase: Enabled */}
        {phase === "enabled" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Your account is protected with two-factor authentication.
              You&apos;ll need your authenticator app each time you sign in.
            </p>
            <button
              onClick={() => {
                setShowDisableModal(true);
                setError("");
              }}
              className="btn-secondary text-danger-600 dark:text-danger-400 border-danger-500/30 hover:bg-danger-50 dark:hover:bg-danger-500/10"
            >
              Disable Two-Factor Authentication
            </button>
          </div>
        )}
      </div>

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold font-display">
              Disable Two-Factor Authentication
            </h3>
            <p className="text-sm text-muted">
              Enter your password and a code from your authenticator app to
              disable MFA.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="label">Authenticator code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                className="input font-mono text-center tracking-widest"
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisablePassword("");
                  setDisableCode("");
                  setError("");
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={disableMfa}
                disabled={
                  loading || !disablePassword || disableCode.length !== 6
                }
                className="btn-primary flex-1 !bg-danger-600 hover:!bg-danger-700"
              >
                {loading ? "Disabling..." : "Disable MFA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
