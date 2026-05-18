"use client";

import { ArrowUpRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useExerciseInsights, type ExerciseInsightsData } from "@/lib/hooks/useExerciseInsights";

export interface ExerciseInspectorSheetProps {
  open: boolean;
  onClose: () => void;
  athleteId: string;
  exerciseId: string;
  contextSessionId: string;
}

/**
 * Coach mobile exercise inspector — read-only bottom sheet at 78% height.
 *
 * Five sections (correlation, history sparkline, prescribed, last note,
 * citations) — same data as the desktop right-rail, mobile-shaped. No
 * "Add observation" CTA (the parent FAB owns that), no editing of
 * prescription (read-only on phones), no compare-to-other-athletes.
 *
 * The Sheet primitive provides focus trap, body scroll lock, Escape close,
 * scrim click close, and the `--surface-overlay` opaque content panel
 * (mandatory per CLAUDE.md §Overlay Surfaces).
 */
export function ExerciseInspectorSheet({
  open,
  onClose,
  athleteId,
  exerciseId,
  contextSessionId,
}: ExerciseInspectorSheetProps) {
  const insights = useExerciseInsights({
    athleteId,
    exerciseId,
    contextSessionId,
    enabled: open,
  });

  const data = insights.status === "ready" ? insights.data : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      size="lg"
      title={<SheetTitle data={data} />}
      ariaLabel="Exercise inspector"
      className="!max-h-[78dvh] !h-[78dvh]"
    >
      {insights.status === "loading" ? (
        <SheetSkeleton />
      ) : insights.status === "error" ? (
        <ErrorState message={insights.error} />
      ) : data ? (
        <SheetBody data={data} />
      ) : null}
    </Sheet>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function SheetTitle({ data }: { data: ExerciseInsightsData | null }) {
  if (!data) {
    return (
      <span
        className="block min-h-[44px] font-mono text-nano uppercase tracking-[0.22em] text-[var(--brand-color)]"
        style={{ color: "#B8830C" }}
      >
        SELECTED · CORRELATION
      </span>
    );
  }
  const titleText = formatTitle(data.exercise.name, data.exercise.implementKg);
  const sub = data.laneName ? `${capitalize(data.laneName)}.` : "";
  return (
    <div>
      <div className="font-mono text-nano uppercase tracking-[0.22em]" style={{ color: "#B8830C" }}>
        SELECTED · CORRELATION
      </div>
      <h2
        id="sheet-title"
        className="mt-1 font-heading text-section font-semibold leading-tight tracking-[-0.005em] text-[var(--foreground)]"
      >
        {titleText}
      </h2>
      {sub ? <p className="mt-1 text-micro text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

// ── Body ────────────────────────────────────────────────────────────────────

function SheetBody({ data }: { data: ExerciseInsightsData }) {
  return (
    <div className="px-1.5 pt-1 pb-6">
      <Section label="Correlation to comp">
        {data.correlation ? (
          <CorrelationBlock c={data.correlation} />
        ) : (
          <EmptyText>
            No transfer data on file. Add a coefficient in the Exercise Library and it will surface
            here.
          </EmptyText>
        )}
      </Section>

      <Section
        label={`${data.athleteFirstName.toUpperCase()}'S LAST 6 SESSIONS${
          data.exercise.implementKg != null ? ` · ${formatKg(data.exercise.implementKg)} BEST` : ""
        }`}
      >
        {data.history.length > 0 ? (
          <HistorySparkline history={data.history} />
        ) : (
          <EmptyText>No throws logged at this implement weight yet.</EmptyText>
        )}
      </Section>

      <Section label="Prescribed">
        <KvRow k="Throws" v={formatNumber(data.prescribed.throws)} />
        <KvRow k="Target RPE" v={formatNumber(data.prescribed.targetRpe)} />
        <KvRow k="Rest" v={data.prescribed.rest ?? "—"} />
        {data.prescribed.cueFocus ? (
          <KvRow k="Cue focus" v={data.prescribed.cueFocus} mono={false} />
        ) : null}
      </Section>

      {data.lastNote ? (
        <Section label="Last note">
          <NoteCard quote={data.lastNote.quote} attribution={data.lastNote.authorLabel} />
        </Section>
      ) : null}

      <Section label="Citations" hideBorder>
        {data.citations.map((c) => (
          <CitationRow key={c.label} label={c.label} href={c.href} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
  hideBorder,
}: {
  label: string;
  children: React.ReactNode;
  hideBorder?: boolean;
}) {
  return (
    <section
      className={`mb-[18px] pb-[18px] ${
        hideBorder ? "" : "border-b border-[var(--card-border)]"
      } last:mb-0 last:border-b-0 last:pb-0`}
    >
      <div className="mb-2.5 font-mono text-nano uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </div>
      {children}
    </section>
  );
}

function CorrelationBlock({ c }: { c: NonNullable<ExerciseInsightsData["correlation"]> }) {
  const bandClass =
    c.band === "HIGH"
      ? "bg-success-500/10 text-success-500"
      : c.band === "MEDIUM"
        ? "bg-warning-500/10 text-warning-500"
        : "bg-surface-200 text-[var(--muted)] dark:bg-surface-800";
  const captionParts: string[] = [];
  if (c.population) captionParts.push(c.population.toUpperCase());
  if (c.sampleSize != null) captionParts.push(`N=${c.sampleSize}`);
  return (
    <>
      <div className="mb-2 flex items-baseline gap-2.5">
        <span className="font-mono text-3xl font-semibold leading-none tabular-nums tracking-[-0.01em] text-[var(--foreground)]">
          {c.coefficient.toFixed(2)}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-nano font-medium uppercase tracking-[0.1em] ${bandClass}`}
        >
          {c.band} TRANSFER
        </span>
      </div>
      <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-success-500 to-amber-300"
          style={{ width: `${c.coefficient * 100}%` }}
        />
      </div>
      <div className="font-mono text-nano tracking-[0.04em] text-[var(--muted)]">
        {captionParts.join(" · ") || "—"}
      </div>
    </>
  );
}

function HistorySparkline({ history }: { history: ExerciseInsightsData["history"] }) {
  const max = Math.max(...history.map((h) => h.distance), 0);
  const safeMax = max > 0 ? max : 1;
  return (
    <>
      <div
        className="mb-2 flex h-12 items-end gap-1.5"
        role="img"
        aria-label={`Last ${history.length} sessions at this implement`}
      >
        {history.map((h, i) => {
          const heightPct = Math.max(8, (h.distance / safeMax) * 100);
          return (
            <div key={i} className="relative flex-1">
              <div
                className={`w-full rounded-t-[3px] ${
                  h.isCurrent ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-700"
                }`}
                style={{ height: `${heightPct}%` }}
              />
              {h.isCurrent ? (
                <span
                  className="absolute -top-2 left-1/2 inline-block h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-primary-500"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-nano tracking-[0.04em] text-[var(--muted)]">
        <span>{history[0]?.label ?? ""}</span>
        {history.length > 2 ? <span>{history[Math.floor(history.length / 2)].label}</span> : null}
        <span
          className={
            history[history.length - 1]?.isCurrent ? "font-medium text-[var(--foreground)]" : ""
          }
        >
          {history[history.length - 1]?.isCurrent ? "TODAY" : history[history.length - 1]?.label}
        </span>
      </div>
    </>
  );
}

function KvRow({ k, v, mono = true }: { k: string; v: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--card-border)] py-[7px] text-micro last:border-b-0">
      <span className="text-[var(--muted)]">{k}</span>
      <span
        className={`font-medium tabular-nums text-[var(--foreground)] ${mono ? "font-mono" : ""}`}
      >
        {String(v)}
      </span>
    </div>
  );
}

function NoteCard({ quote, attribution }: { quote: string; attribution: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--card-border)] bg-surface-50 px-3.5 py-3 dark:bg-surface-900/60">
      <p className="text-caption italic leading-[1.5] text-[var(--foreground)]">
        &ldquo;{quote}&rdquo;
      </p>
      <p className="mt-1.5 font-mono text-nano tracking-[0.04em] text-[var(--muted)]">
        — {attribution}
      </p>
    </div>
  );
}

function CitationRow({ label, href }: { label: string; href: string | null }) {
  const inner = (
    <span className="inline-flex items-center gap-1 text-[var(--muted)]">
      Open <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
  return (
    <div className="flex items-center justify-between border-b border-[var(--card-border)] py-[7px] text-micro last:border-b-0">
      <span className="text-[var(--muted)]">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md hover:text-[var(--foreground)]"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}

// ── Loading + error states ──────────────────────────────────────────────────

function SheetSkeleton() {
  return (
    <div className="px-1.5 pt-1 pb-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`mb-[18px] pb-[18px] ${i < 4 ? "border-b border-[var(--card-border)]" : ""}`}
        >
          <div className="mb-2.5 h-[10px] w-24 animate-pulse rounded bg-surface-200 dark:bg-surface-800" />
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-200 dark:bg-surface-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-200 dark:bg-surface-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-1.5 pt-4">
      <p className="text-caption text-danger-500">Couldn&apos;t load insights — {message}</p>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-micro leading-relaxed text-[var(--muted)]">{children}</p>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTitle(name: string, implementKg: number | null): string {
  if (implementKg == null) return name;
  return `${name} · ${formatKg(implementKg)}`;
}

function formatKg(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}kg`;
}

function formatNumber(n: number | null): string {
  return n == null ? "—" : String(n);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
