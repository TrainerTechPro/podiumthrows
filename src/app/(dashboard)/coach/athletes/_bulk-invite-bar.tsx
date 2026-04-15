"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Copy, Check, X } from "lucide-react";
import { Button, Modal } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthleteRosterItem } from "@/lib/data/coach";

type ResultRow = {
  athleteId: string;
  name: string;
  link: string | null;
  error: string | null;
};

/**
 * Bulk-invite affordance. Shown above the roster table when ≥2 athletes are
 * in PROXY state (not invited yet). Generates one link-mode invitation per
 * athlete via parallel POST, then presents the collection so the coach can
 * copy each (or all) and share via text, DM, email, etc.
 *
 * Email-mode bulk invite is out of scope — AthleteProfile doesn't store
 * athlete email today (only placeholder User.email), so each proxy would
 * need a separate email-collection UX. Link-mode is the universally viable
 * path for bulk right now.
 */
export function BulkInviteBar({ data }: { data: AthleteRosterItem[] }) {
  const router = useRouter();
  const toast = useToast();

  const proxies = useMemo(() => data.filter((a) => a.claimStatus === "PROXY"), [data]);

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Show nothing if fewer than 2 proxies — the per-row "Send invite →" is fine.
  if (proxies.length < 2) return null;

  async function handleBulkSend() {
    setSending(true);
    setResults(null);

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const settled = await Promise.allSettled(
      proxies.map((p) =>
        fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ mode: "link", athleteProfileId: p.id }),
        }).then(async (res) => {
          const payload = await res.json();
          if (!res.ok || !payload.success) {
            throw new Error(payload.error || `Request failed (${res.status})`);
          }
          return { athleteId: p.id, token: payload.data.token as string };
        })
      )
    );

    const rows: ResultRow[] = settled.map((s, i) => {
      const p = proxies[i];
      const name = `${p.firstName} ${p.lastName}`;
      if (s.status === "fulfilled") {
        return {
          athleteId: p.id,
          name,
          link: `${origin}/athletes/claim/${s.value.token}`,
          error: null,
        };
      }
      return {
        athleteId: p.id,
        name,
        link: null,
        error: s.reason instanceof Error ? s.reason.message : "Failed",
      };
    });

    setResults(rows);
    setSending(false);

    const ok = rows.filter((r) => r.link).length;
    const failed = rows.length - ok;
    if (failed === 0) {
      toast.success(`Created ${ok} invite link${ok === 1 ? "" : "s"}`);
    } else if (ok === 0) {
      toast.error("Bulk invite failed", "None of the links were created.");
    } else {
      toast.warning(
        `Created ${ok} of ${rows.length} links`,
        "Some athletes couldn't be invited — see modal for details."
      );
    }

    router.refresh();
  }

  function openModal() {
    setOpen(true);
    setResults(null);
    setCopiedAll(false);
    setCopiedId(null);
  }

  function closeModal() {
    setOpen(false);
  }

  async function copyOne(row: ResultRow) {
    if (!row.link) return;
    try {
      await navigator.clipboard.writeText(row.link);
      setCopiedId(row.athleteId);
      setTimeout(() => setCopiedId((id) => (id === row.athleteId ? null : id)), 2000);
    } catch {
      toast.error("Clipboard unavailable", "Copy the link manually.");
    }
  }

  async function copyAll() {
    if (!results) return;
    const text = results
      .filter((r) => r.link)
      .map((r) => `${r.name}: ${r.link}`)
      .join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      toast.success("All links copied", "One athlete per line, ready to paste.");
    } catch {
      toast.error("Clipboard unavailable", "Copy each link manually below.");
    }
  }

  return (
    <>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {proxies.length} athlete{proxies.length === 1 ? "" : "s"} haven&apos;t been invited yet
          </p>
          <p className="text-xs text-muted mt-0.5">
            Generate one invite link per athlete in a single click — share them via text, chat, or
            email.
          </p>
        </div>
        <Button variant="primary" onClick={openModal} className="shrink-0">
          <Send size={14} strokeWidth={1.75} className="mr-1.5" aria-hidden="true" />
          Send invites to all
        </Button>
      </div>

      <Modal
        open={open}
        onClose={closeModal}
        title={results ? "Invite links ready" : "Send bulk invites"}
        description={
          results
            ? "Share the links below. Each is one-time use and expires in 7 days."
            : `Generate ${proxies.length} one-time invite links — one per uninvited athlete.`
        }
        size="lg"
        footer={
          results ? (
            <div className="flex items-center justify-between w-full gap-2">
              <Button variant="ghost" size="sm" onClick={copyAll} disabled={copiedAll}>
                {copiedAll ? (
                  <>
                    <Check size={14} className="mr-1.5" strokeWidth={1.75} aria-hidden="true" />
                    All copied
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1.5" strokeWidth={1.75} aria-hidden="true" />
                    Copy all
                  </>
                )}
              </Button>
              <Button variant="primary" onClick={closeModal}>
                Done
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" onClick={closeModal} disabled={sending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleBulkSend} loading={sending}>
                Generate {proxies.length} links
              </Button>
            </div>
          )
        }
      >
        {results ? (
          <ul className="divide-y divide-[var(--card-border)] max-h-96 overflow-y-auto custom-scrollbar">
            {results.map((row) => (
              <li key={row.athleteId} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.name}</p>
                  {row.link ? (
                    <p className="text-xs text-muted font-mono truncate">{row.link}</p>
                  ) : (
                    <p className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
                      <X size={12} strokeWidth={1.75} aria-hidden="true" />
                      {row.error ?? "Failed"}
                    </p>
                  )}
                </div>
                {row.link && (
                  <button
                    type="button"
                    onClick={() => copyOne(row)}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-300 hover:underline shrink-0"
                  >
                    {copiedId === row.athleteId ? "Copied" : "Copy"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-[var(--card-border)]">
            {proxies.map((p) => (
              <li key={p.id} className="py-2 text-sm">
                {p.firstName} {p.lastName}
                {p.events.length > 0 && (
                  <span className="text-muted text-xs ml-2">· {p.events.join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
