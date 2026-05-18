"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

const REQUIRED_PHRASE = "DELETE";

interface Props {
  role: "COACH" | "ATHLETE";
}

/**
 * Two-step destructive flow: section card with explanation + a danger
 * button that opens a modal requiring the user to type "DELETE" before
 * the destructive call fires. The API does the eligibility check; if the
 * coach has athletes on the roster, the 409 error message is surfaced
 * via toast and the modal stays open so they can read it.
 */
export function DeleteAccountSection({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  function close() {
    if (loading) return;
    setOpen(false);
    setConfirmText("");
  }

  async function handleDelete() {
    if (confirmText !== REQUIRED_PHRASE) return;
    setLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      const payload = (await res.json().catch(() => null)) as {
        success: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || "Could not delete account");
        setLoading(false);
        return;
      }

      // Hard redirect — the auth cookie was cleared server-side, and
      // /goodbye is unauthenticated.
      window.location.assign("/goodbye");
    } catch {
      toast.error("Network error — try again in a moment");
      setLoading(false);
    }
  }

  return (
    <section className="card border border-danger-500/30 p-5 space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-danger-500 uppercase tracking-wider">
          Danger zone
        </h2>
        <p className="text-sm text-[var(--foreground)]">
          Delete your account. You&apos;ll have 30 days to restore before everything is permanently
          removed.
          {role === "COACH" ? (
            <>
              {" "}
              If you have athletes on your roster, remove them first — your account can&apos;t be
              deleted while it&apos;s their coach of record.
            </>
          ) : null}
        </p>
      </header>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Delete your account"
        size="md"
        preventClose={loading}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={loading}
              disabled={confirmText !== REQUIRED_PHRASE}
            >
              Delete forever
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--foreground)]">
            This soft-deletes your account immediately. You have 30 days to log back in and restore
            it. After 30 days, all your data is permanently removed.
          </p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            {role === "ATHLETE" ? (
              <>
                <li>Your throws, sessions, PRs, and readiness logs.</li>
                <li>Your coach loses access to your historical data.</li>
              </>
            ) : (
              <>
                <li>Your coach profile and account settings.</li>
                <li>Programs, drills, notes, and questionnaires you authored.</li>
              </>
            )}
            <li>You&apos;ll be signed out on every device.</li>
          </ul>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Type {REQUIRED_PHRASE} to confirm
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-danger-500/50"
              disabled={loading}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
