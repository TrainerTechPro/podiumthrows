"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   ProgrammingMockup
   ─────────────────
   Static visual mockup of the week programming feature. Displays a 5-column
   Mon–Fri week view with session cards using tier-colored left borders.
   Used inside the StickyFeatures section when the "Programming" feature
   is active.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionCard = {
  type: "throws" | "strength";
  name: string;
  detail: string;
};

type DayColumn = {
  day: string;
  sessions: SessionCard[];
  rest?: boolean;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const WEEK_DAYS: DayColumn[] = [
  {
    day: "Mon",
    sessions: [
      { type: "throws", name: "AM Throws", detail: "SP · 38 throws" },
      { type: "strength", name: "PM Strength", detail: "Clean + Squat" },
    ],
  },
  {
    day: "Tue",
    sessions: [
      { type: "throws", name: "AM Throws", detail: "SP · 32 throws" },
    ],
  },
  {
    day: "Wed",
    sessions: [],
    rest: true,
  },
  {
    day: "Thu",
    sessions: [
      { type: "throws", name: "AM Throws", detail: "DT · 40 throws" },
      { type: "strength", name: "PM Strength", detail: "Snatch + DL" },
    ],
  },
  {
    day: "Fri",
    sessions: [
      { type: "throws", name: "AM Throws", detail: "DT · 28 throws" },
    ],
  },
];

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SessionCardItem({ session }: { session: SessionCard }) {
  const isThrows = session.type === "throws";

  return (
    <div
      style={{
        background: "var(--landing-bg)",
        border: "1px solid var(--landing-border)",
        borderLeft: isThrows
          ? "2px solid rgba(245,158,11,0.6)"
          : "2px solid rgba(99,102,241,0.5)",
        borderRadius: 6,
        padding: "7px 8px",
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--landing-text)",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {session.name}
      </div>
      <div
        style={{
          fontSize: 8,
          color: "var(--landing-text-muted)",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          marginTop: 2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {session.detail}
      </div>
    </div>
  );
}

function DayCol({ col }: { col: DayColumn }) {
  return (
    <div
      className="flex flex-col"
      style={{ gap: 4, flex: 1, minWidth: 0 }}
    >
      {/* Day header */}
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--landing-text-muted)",
          textAlign: "center",
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {col.day}
      </div>

      {/* Sessions or rest */}
      {col.rest ? (
        <div
          style={{
            fontSize: 9,
            color: "var(--landing-text-dim)",
            textAlign: "center",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            paddingTop: 8,
          }}
        >
          Rest
        </div>
      ) : (
        col.sessions.map((session, i) => (
          <SessionCardItem key={i} session={session} />
        ))
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProgrammingMockup() {
  return (
    <div
      className="w-full select-none"
      style={{
        borderRadius: 14,
        border: "1px solid var(--landing-border)",
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02)",
        overflow: "hidden",
        background: "var(--landing-surface)",
      }}
      aria-hidden="true"
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "10px 14px" }}
      >
        <span
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--landing-text)",
          }}
        >
          Week Programming — Shot Put Group
        </span>

        <span
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            color: "#f59e0b",
            background: "var(--landing-amber-glow-strong)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 6,
            padding: "3px 8px",
          }}
        >
          Week 12
        </span>
      </div>

      {/* ── Week grid ───────────────────────────────────────────────── */}
      <div
        className="flex"
        style={{
          gap: 6,
          padding: "0 14px 14px 14px",
          alignItems: "flex-start",
        }}
      >
        {WEEK_DAYS.map((col) => (
          <DayCol key={col.day} col={col} />
        ))}
      </div>
    </div>
  );
}
