"use client";

import { useState, useCallback } from "react";
import type { ProgrammedSessionWithDetails, SessionTier } from "@/lib/data/programming";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Button, Badge, Modal } from "@/components";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/ui/Toast";
import { TemplatePicker } from "./_template-picker";
import { csrfHeaders } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";
import { Users, User } from "lucide-react";

import { logger } from "@/lib/logger";
/* ─── Tier badge colors ────────────────────────────────────────────────── */

const TIER_BADGE_VARIANT: Record<SessionTier, "info" | "primary" | "success"> = {
  TEAM: "info",
  GROUP: "primary",
  INDIVIDUAL: "success",
};

/* ─── Types ────────────────────────────────────────────────────────────── */

interface SessionSidebarProps {
  mode: "create" | "edit";
  session?: ProgrammedSessionWithDetails | null;
  date?: string | null;
  tier: SessionTier;
  groupId?: string | null;
  groups: EventGroupItem[];
  onClose: () => void;
  onSaved: () => void;
}

interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function SessionSidebar({
  mode,
  session,
  date,
  tier,
  groupId,
  groups,
  onClose,
  onSaved,
}: SessionSidebarProps) {
  /* ── Form state ─────────────────────────────────────────────────────── */
  const [title, setTitle] = useState(session?.title ?? "Training Session");
  const [throwsSessionId, setThrowsSessionId] = useState<string | null>(
    session?.throwsSession.id ?? null
  );
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [scheduledDate, setScheduledDate] = useState(session?.scheduledDate ?? date ?? "");
  const [submitting, setSubmitting] = useState(false);

  /* ── Override modal state ───────────────────────────────────────────── */
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideTier, setOverrideTier] = useState<"GROUP" | "INDIVIDUAL">("GROUP");
  const [overrideGroupId, setOverrideGroupId] = useState<string>("");
  const [overrideAthleteId, setOverrideAthleteId] = useState<string>("");
  const [overrideTemplateId, setOverrideTemplateId] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(false);

  const { success: toastSuccess, error: toastError } = useToast();

  /* Sheet + Modal both handle their own Escape; nothing extra needed here. */

  /* ── Fetch athletes for override modal ──────────────────────────────── */
  const fetchAthletes = useCallback(async () => {
    if (athletes.length > 0) return; // already loaded
    setAthletesLoading(true);
    try {
      const res = await fetch("/api/coach/athletes");
      if (!res.ok) throw new Error("Failed to load athletes");
      const json = await res.json();
      setAthletes(
        (json.data ?? []).map((a: { id: string; firstName: string; lastName: string }) => ({
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
        }))
      );
    } catch (err) {
      logger.error("[SessionSidebar] fetch athletes error:", {
        context: "coach/schedule/session-sidebar",
        error: err,
      });
    } finally {
      setAthletesLoading(false);
    }
  }, [athletes.length]);

  /* ── Save (create or update) as draft ───────────────────────────────── */
  const handleSaveDraft = useCallback(async () => {
    if (!title.trim() || !throwsSessionId || !scheduledDate) {
      toastError("Missing fields", "Title, template, and date are required.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/coach/programming", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            title: title.trim(),
            scheduledDate,
            throwsSessionId,
            tier,
            groupId: groupId ?? undefined,
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to create session");
        }
      } else if (session) {
        const res = await fetch(`/api/coach/programming/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            title: title.trim(),
            throwsSessionId,
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to update session");
        }
      }

      toastSuccess("Saved", "Session saved as draft.");
      onSaved();
    } catch (err) {
      toastError("Error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [
    mode,
    session,
    title,
    throwsSessionId,
    scheduledDate,
    tier,
    groupId,
    notes,
    toastSuccess,
    toastError,
    onSaved,
  ]);

  /* ── Publish ────────────────────────────────────────────────────────── */
  const handlePublish = useCallback(async () => {
    if (!title.trim() || !throwsSessionId || !scheduledDate) {
      toastError("Missing fields", "Title, template, and date are required.");
      return;
    }

    setSubmitting(true);
    try {
      let sessionId = session?.id;

      // Create or update first
      if (mode === "create") {
        const res = await fetch("/api/coach/programming", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            title: title.trim(),
            scheduledDate,
            throwsSessionId,
            tier,
            groupId: groupId ?? undefined,
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to create session");
        }
        const created = await res.json();
        sessionId = created.data?.id;
      } else if (session) {
        const res = await fetch(`/api/coach/programming/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            title: title.trim(),
            throwsSessionId,
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to update session");
        }
      }

      if (!sessionId) throw new Error("No session ID available for publish");

      // Then publish
      const pubRes = await fetch(`/api/coach/programming/${sessionId}/publish`, {
        method: "POST",
        headers: { ...csrfHeaders() },
      });
      if (!pubRes.ok) {
        const json = await pubRes.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to publish session");
      }

      const pubJson = await pubRes.json();
      const created = pubJson.data?.assignmentsCreated ?? 0;
      const updated = pubJson.data?.assignmentsUpdated ?? 0;

      toastSuccess("Published!", `${created} assigned, ${updated} updated`);
      onSaved();
    } catch (err) {
      toastError("Publish failed", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [
    mode,
    session,
    title,
    throwsSessionId,
    scheduledDate,
    tier,
    groupId,
    notes,
    toastSuccess,
    toastError,
    onSaved,
  ]);

  /* ── Delete ─────────────────────────────────────────────────────────── */
  const handleDelete = useCallback(async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/coach/programming/${session.id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to delete session");
      }
      toastSuccess("Deleted", "Session has been removed.");
      onSaved();
    } catch (err) {
      toastError("Error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [session, toastSuccess, toastError, onSaved]);

  const confirmDelete = useCallback(() => {
    if (window.confirm("Delete this session? This cannot be undone.")) {
      handleDelete();
    }
  }, [handleDelete]);

  /* ── Create override ────────────────────────────────────────────────── */
  const handleOpenOverride = useCallback(() => {
    setOverrideTier("GROUP");
    setOverrideGroupId(groups[0]?.id ?? "");
    setOverrideAthleteId("");
    setOverrideTemplateId(null);
    setOverrideOpen(true);
    fetchAthletes();
  }, [groups, fetchAthletes]);

  const handleSubmitOverride = useCallback(async () => {
    if (!session || !overrideTemplateId) {
      toastError("Missing fields", "Please select a template for the override.");
      return;
    }

    if (overrideTier === "GROUP" && !overrideGroupId) {
      toastError("Missing fields", "Please select a group.");
      return;
    }
    if (overrideTier === "INDIVIDUAL" && !overrideAthleteId) {
      toastError("Missing fields", "Please select an athlete.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/coach/programming/${session.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          throwsSessionId: overrideTemplateId,
          tier: overrideTier,
          groupId: overrideTier === "GROUP" ? overrideGroupId : undefined,
          athleteId: overrideTier === "INDIVIDUAL" ? overrideAthleteId : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to create override");
      }

      toastSuccess("Override created", "The override has been saved.");
      setOverrideOpen(false);
      onSaved();
    } catch (err) {
      toastError("Error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [
    session,
    overrideTemplateId,
    overrideTier,
    overrideGroupId,
    overrideAthleteId,
    toastSuccess,
    toastError,
    onSaved,
  ]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  const sheetTitle = (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="truncate">{mode === "create" ? "New Session" : "Edit Session"}</span>
      <Badge variant={TIER_BADGE_VARIANT[tier]}>{tier}</Badge>
    </div>
  );

  const sheetFooter = (
    <div className="w-full space-y-3">
      {/* Primary actions row */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSaveDraft}
          disabled={submitting}
          loading={submitting}
          className="flex-1"
        >
          Save Draft
        </Button>

        {/* Publish — desktop button */}
        <div className="hidden sm:flex flex-1">
          <Button
            variant="primary"
            size="sm"
            onClick={handlePublish}
            disabled={submitting}
            loading={submitting}
            className="w-full"
          >
            Publish
          </Button>
        </div>
      </div>

      {/* Publish — mobile slide */}
      <div className="sm:hidden">
        <SlideToConfirm
          label="Slide to Publish"
          onConfirm={handlePublish}
          disabled={submitting}
          variant="confirm"
        />
      </div>

      {/* Secondary actions (edit mode) */}
      {mode === "edit" && session && (
        <div className="flex items-center gap-2 pt-1">
          {/* Create Override (TEAM tier only) */}
          {tier === "TEAM" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenOverride}
              disabled={submitting}
              className="flex-1"
            >
              Create Override
            </Button>
          )}

          {/* Delete — desktop */}
          <div className="hidden sm:block">
            <Button
              variant="ghost"
              size="sm"
              onClick={confirmDelete}
              disabled={submitting}
              className="text-danger-500 hover:text-danger-600"
            >
              Delete
            </Button>
          </div>

          {/* Delete — mobile slide */}
          <div className="sm:hidden flex-1">
            <SlideToConfirm
              label="Slide to Delete"
              onConfirm={handleDelete}
              disabled={submitting}
              variant="destructive"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Sheet open onClose={onClose} side="right" size="lg" title={sheetTitle} footer={sheetFooter}>
        <div className="space-y-5">
          {/* Title */}
          <Input
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Training Session"
          />

          {/* Template */}
          <TemplatePicker value={throwsSessionId} onChange={setThrowsSessionId} />

          {/* Notes */}
          <div className="w-full space-y-1.5">
            <label htmlFor="session-notes" className="label">
              Notes
            </label>
            <textarea
              id="session-notes"
              className="input min-h-[80px] resize-y"
              placeholder="Coach notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Date (create mode only) */}
          {mode === "create" && (
            <div className="w-full space-y-1.5">
              <label htmlFor="session-date" className="label">
                Date
              </label>
              <input
                id="session-date"
                type="date"
                className="input"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          )}

          {/* Group / athlete info (read-only context) */}
          {session?.group && (
            <div className="text-sm text-muted">
              <span className="font-medium text-[var(--foreground)]">Group:</span>{" "}
              {session.group.name}
            </div>
          )}
          {session?.athlete && (
            <div className="text-sm text-muted">
              <span className="font-medium text-[var(--foreground)]">Athlete:</span>{" "}
              {session.athlete.firstName} {session.athlete.lastName}
            </div>
          )}
        </div>
      </Sheet>

      {/* Override Modal */}
      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Create Override"
        description="Override the team session for a specific group or athlete."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOverrideOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitOverride}
              disabled={submitting || !overrideTemplateId}
              loading={submitting}
            >
              Create Override
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Tier radio */}
          <fieldset className="space-y-2">
            <legend className="label mb-1">Override for</legend>
            <label
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                overrideTier === "GROUP"
                  ? "border-primary-500 bg-primary-500/5"
                  : "border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50"
              )}
            >
              <input
                type="radio"
                name="override-tier"
                value="GROUP"
                checked={overrideTier === "GROUP"}
                onChange={() => setOverrideTier("GROUP")}
                className="accent-primary-500"
              />
              <Users size={16} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
              <span className="text-sm font-medium text-[var(--foreground)]">A Group</span>
            </label>
            <label
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                overrideTier === "INDIVIDUAL"
                  ? "border-primary-500 bg-primary-500/5"
                  : "border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50"
              )}
            >
              <input
                type="radio"
                name="override-tier"
                value="INDIVIDUAL"
                checked={overrideTier === "INDIVIDUAL"}
                onChange={() => setOverrideTier("INDIVIDUAL")}
                className="accent-primary-500"
              />
              <User size={16} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
              <span className="text-sm font-medium text-[var(--foreground)]">An Individual</span>
            </label>
          </fieldset>

          {/* Group selector */}
          {overrideTier === "GROUP" && (
            <div className="w-full space-y-1.5">
              <label htmlFor="override-group" className="label">
                Group
              </label>
              <select
                id="override-group"
                className="input"
                value={overrideGroupId}
                onChange={(e) => setOverrideGroupId(e.target.value)}
              >
                <option value="">Select a group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberCount} member{g.memberCount !== 1 ? "s" : ""})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Athlete selector */}
          {overrideTier === "INDIVIDUAL" && (
            <div className="w-full space-y-1.5">
              <label htmlFor="override-athlete" className="label">
                Athlete
              </label>
              <select
                id="override-athlete"
                className="input"
                value={overrideAthleteId}
                onChange={(e) => setOverrideAthleteId(e.target.value)}
                disabled={athletesLoading}
              >
                <option value="">
                  {athletesLoading ? "Loading athletes..." : "Select an athlete..."}
                </option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Override template */}
          <TemplatePicker value={overrideTemplateId} onChange={setOverrideTemplateId} />
        </div>
      </Modal>
    </>
  );
}
