import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAssignmentDetailForCoach } from "@/lib/data/coach";
import { formatEventType } from "@/lib/utils";
import {
  PrintShell,
  PrintHeader,
  PrintFooter,
  formatPrintDate,
} from "@/components/print/PrintShell";

export const metadata = { title: "Print Session Card — Podium Throws" };
export const dynamic = "force-dynamic";

const BLOCK_LABEL: Record<string, string> = {
  WARMUP: "Warm-Up",
  THROWING: "Throwing",
  STRENGTH: "Strength",
  PLYOMETRIC: "Plyometric",
  COOLDOWN: "Cool-Down",
  NOTES: "Notes",
};

interface ThrowingConfig {
  implementWeight?: string;
  implementWeightKg?: number;
  throwCount?: number;
  intensityMin?: number;
  intensityMax?: number;
  techniqueFocus?: string;
  notes?: string;
}

interface StrengthExercise {
  name: string;
  sets?: number;
  reps?: number;
  percentage?: number;
  classification?: string;
}

interface StrengthConfig {
  exercises?: StrengthExercise[];
  notes?: string;
}

interface WarmCoolDrillObject {
  name: string;
  duration?: number;
  notes?: string;
}

interface WarmCoolConfig {
  duration?: number;
  // Legacy plans store drills as bare strings; the athlete start-live flow
  // writes them as { name, duration?, notes? } objects. Both shapes coexist
  // and must render — see PODIUM-THROWS-S.
  drills?: Array<string | WarmCoolDrillObject>;
  notes?: string;
}

interface NotesConfig {
  text?: string;
}

function parseConfig<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatTechnique(focus?: string): string | null {
  if (!focus || focus === "FULL_THROW") return null;
  return focus
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAssignedDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CoachThrowsSessionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;

  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true, lastName: true, organization: true },
  });
  if (!coach) redirect("/login");

  const assignment = await getAssignmentDetailForCoach(coach.id, assignmentId);
  if (!assignment) notFound();

  const athlete = assignment.athlete;
  const ses = assignment.session;
  const blocks = ses.blocks;

  // Bondarchuk session-structure note: blocks already arrive in `position` order
  // (THROWING → STRENGTH → THROWING → STRENGTH → COOLDOWN). We render them in
  // that order without re-sorting so the printed card mirrors execution order.
  const throwingCount = blocks.filter((b) => b.blockType === "THROWING").length;
  const strengthCount = blocks.filter((b) => b.blockType === "STRENGTH").length;

  return (
    <PrintShell
      orientation="landscape"
      backHref={`/coach/throws/${assignmentId}`}
      backLabel="Back to session"
    >
      <PrintHeader
        title={ses.name}
        byline={
          <>
            <span className="font-semibold">
              {athlete.firstName} {athlete.lastName}
            </span>
            <span className="text-muted print:text-surface-600">
              {" "}
              &middot; {formatEventType(ses.event)}
            </span>
            {athlete.events && athlete.events.length > 1 && (
              <span className="text-muted print:text-surface-600">
                {" "}
                &middot; Events: {athlete.events.map((e) => formatEventType(e)).join(", ")}
              </span>
            )}
          </>
        }
        rightSlot={<>{formatAssignedDate(assignment.assignedDate)}</>}
        subtitle={[
          `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}`,
          throwingCount > 0
            ? `${throwingCount} throwing ${throwingCount === 1 ? "block" : "blocks"}`
            : null,
          strengthCount > 0
            ? `${strengthCount} strength ${strengthCount === 1 ? "block" : "blocks"}`
            : null,
          `Coach: ${coach.firstName} ${coach.lastName}${coach.organization ? ` · ${coach.organization}` : ""}`,
          `Printed ${formatPrintDate()}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {ses.notes && (
        <p className="text-xs italic text-muted print:text-surface-700 mb-4 leading-relaxed border-l-2 border-surface-300 print:border-surface-400 pl-3">
          {ses.notes}
        </p>
      )}

      {/* Two-column layout: prescription (left) + observation space (right). */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-5 print-keep-together">
        {/* ─── Left column: prescribed blocks in execution order ──────── */}
        <section>
          <h2 className="text-nano font-heading font-bold uppercase tracking-wider mb-2 pb-1 border-b border-surface-400 print:text-black print:border-surface-400">
            Session Plan
          </h2>

          <div className="space-y-2.5">
            {blocks.length === 0 ? (
              <p className="text-xs text-muted py-2">No blocks defined for this session.</p>
            ) : (
              blocks.map((b, idx) => {
                const label = BLOCK_LABEL[b.blockType] ?? b.blockType;
                return (
                  <div
                    key={b.id}
                    className="print-block border border-surface-300 print:border-surface-500 rounded-md print:rounded-none p-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <div className="text-xs font-semibold print:text-black">
                        <span className="font-mono text-muted print:text-surface-600 mr-1.5">
                          #{idx + 1}
                        </span>
                        {label}
                      </div>
                    </div>

                    {b.blockType === "THROWING" && (
                      <ThrowingBlockCard config={parseConfig<ThrowingConfig>(b.config)} />
                    )}
                    {b.blockType === "STRENGTH" && (
                      <StrengthBlockCard config={parseConfig<StrengthConfig>(b.config)} />
                    )}
                    {(b.blockType === "WARMUP" ||
                      b.blockType === "COOLDOWN" ||
                      b.blockType === "PLYOMETRIC") && (
                      <WarmCoolBlockCard config={parseConfig<WarmCoolConfig>(b.config)} />
                    )}
                    {b.blockType === "NOTES" && (
                      <NotesBlockCard config={parseConfig<NotesConfig>(b.config)} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ─── Right column: observation / writing space ─────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-nano font-heading font-bold uppercase tracking-wider mb-2 pb-1 border-b border-surface-400 print:text-black print:border-surface-400">
              Athlete State
            </h2>
            <FieldGrid
              fields={[
                { label: "RPE", width: "narrow" },
                { label: "Feeling", width: "narrow" },
                { label: "Body weight", width: "narrow" },
                { label: "Best mark today", width: "narrow" },
              ]}
            />
          </div>

          <div>
            <h2 className="text-nano font-heading font-bold uppercase tracking-wider mb-2 pb-1 border-b border-surface-400 print:text-black print:border-surface-400">
              Coaching Cues
            </h2>
            <NoteLines count={3} />
          </div>

          <div>
            <h2 className="text-nano font-heading font-bold uppercase tracking-wider mb-2 pb-1 border-b border-surface-400 print:text-black print:border-surface-400">
              Observations
            </h2>
            <NoteLines count={6} />
          </div>
        </section>
      </div>

      <PrintFooter />
    </PrintShell>
  );
}

/* ─── Block card components ────────────────────────────────────────────── */

function ThrowingBlockCard({ config }: { config: ThrowingConfig | null }) {
  const weight = config?.implementWeight;
  const throwCount = config?.throwCount;
  const intMin = config?.intensityMin;
  const intMax = config?.intensityMax;
  const technique = formatTechnique(config?.techniqueFocus);

  return (
    <div className="text-xs print:text-black space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {weight && <span className="font-mono font-semibold tabular-nums">{weight}</span>}
        {throwCount != null && (
          <span className="font-mono tabular-nums">
            {throwCount} {throwCount === 1 ? "throw" : "throws"}
          </span>
        )}
        {intMin != null && intMax != null && (
          <span className="text-muted print:text-surface-600">
            Intensity {intMin}&ndash;{intMax}%
          </span>
        )}
      </div>
      {technique && <p className="text-muted print:text-surface-600">Focus: {technique}</p>}
      {config?.notes && <p className="italic text-muted print:text-surface-700">{config.notes}</p>}
    </div>
  );
}

function StrengthBlockCard({ config }: { config: StrengthConfig | null }) {
  const exercises = config?.exercises ?? [];
  if (exercises.length === 0 && !config?.notes) {
    return <p className="text-xs text-muted print:text-surface-600">No exercises specified.</p>;
  }
  return (
    <div className="text-xs print:text-black space-y-1">
      {exercises.length > 0 && (
        <table className="w-full">
          <tbody>
            {exercises.map((ex, i) => (
              <tr key={i} className="align-baseline">
                <td className="py-0.5 pr-2 print:text-black">{ex.name || "Exercise"}</td>
                <td className="py-0.5 text-right font-mono tabular-nums w-20 text-muted print:text-surface-700">
                  {ex.sets != null && ex.reps != null ? `${ex.sets} × ${ex.reps}` : "—"}
                </td>
                <td className="py-0.5 pl-2 text-right font-mono tabular-nums w-12 text-muted print:text-surface-700">
                  {ex.percentage != null ? `${ex.percentage}%` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {config?.notes && <p className="italic text-muted print:text-surface-700">{config.notes}</p>}
    </div>
  );
}

function WarmCoolBlockCard({ config }: { config: WarmCoolConfig | null }) {
  const duration = config?.duration;
  const drills = config?.drills ?? [];
  if (!duration && drills.length === 0 && !config?.notes) {
    return <p className="text-xs text-muted print:text-surface-600">As needed.</p>;
  }
  return (
    <div className="text-xs print:text-black space-y-1">
      {duration && (
        <p className="font-mono tabular-nums text-muted print:text-surface-700">{duration} min</p>
      )}
      {drills.length > 0 && (
        <ul className="space-y-0.5">
          {drills.map((d, i) => {
            const name = typeof d === "string" ? d : d.name;
            const drillDuration = typeof d === "object" ? d.duration : undefined;
            return (
              <li key={i} className="flex items-baseline gap-1.5">
                <span className="text-muted print:text-surface-500">&middot;</span>
                <span className="flex-1">{name}</span>
                {drillDuration ? (
                  <span className="font-mono tabular-nums text-muted print:text-surface-700">
                    {drillDuration}min
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {config?.notes && <p className="italic text-muted print:text-surface-700">{config.notes}</p>}
    </div>
  );
}

function NotesBlockCard({ config }: { config: NotesConfig | null }) {
  const text = config?.text;
  return text ? (
    <p className="text-xs whitespace-pre-wrap print:text-black">{text}</p>
  ) : (
    <p className="text-xs italic text-muted print:text-surface-600">No notes.</p>
  );
}

/* ─── Right-column primitives ──────────────────────────────────────────── */

function FieldGrid({ fields }: { fields: { label: string; width: "narrow" | "wide" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      {fields.map((f) => (
        <div key={f.label} className="flex items-baseline gap-2">
          <span className="text-nano uppercase tracking-wider text-muted print:text-surface-600 shrink-0">
            {f.label}
          </span>
          <span className="flex-1 border-b border-surface-300 print:border-surface-400 h-4" />
        </div>
      ))}
    </div>
  );
}

function NoteLines({ count }: { count: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-b border-surface-200 print:border-surface-300 h-4" />
      ))}
    </div>
  );
}
