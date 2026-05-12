"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroDeviceMockup
   ────────────────
   Purpose-built hero dashboard. Pure HTML/CSS — no images, no real data.
   Shows the actual product differentiator: descending-implement sequences
   and a validation warning that rejects an ascending plan.

   Used only by HeroSection. Sized for a 1200px-wide centerpiece slot.
   ═══════════════════════════════════════════════════════════════════════════ */

const SIDEBAR_ITEMS = [
  { label: "Home", active: false },
  { label: "Roster", active: false },
  { label: "Sessions", active: true },
  { label: "Calendar", active: false },
  { label: "Library", active: false },
  { label: "Settings", active: false },
] as const;

// Status dot helper
function Dot({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: 999,
        background: filled ? "#FFC800" : "transparent",
        border: filled ? "none" : "1px solid var(--landing-border)",
      }}
    />
  );
}

export default function HeroDeviceMockup() {
  return (
    <div
      className="w-full select-none"
      style={{
        borderRadius: 16,
        border: "1px solid var(--landing-border)",
        boxShadow:
          "0 80px 160px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
        background: "var(--landing-bg)",
      }}
      aria-hidden="true"
    >
      {/* ── Browser chrome ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          background: "var(--landing-surface)",
          borderBottom: "1px solid var(--landing-border)",
        }}
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="block rounded-full"
            style={{ width: 11, height: 11, background: "#ff5f57" }}
          />
          <span
            className="block rounded-full"
            style={{ width: 11, height: 11, background: "#febc2e" }}
          />
          <span
            className="block rounded-full"
            style={{ width: 11, height: 11, background: "#28c840" }}
          />
        </div>
        <div
          className="flex-1 mx-3 rounded-md px-3 py-1 text-center font-mono"
          style={{
            background: "var(--landing-surface-2)",
            fontSize: 11,
            color: "var(--landing-text-muted)",
            letterSpacing: "0.02em",
            maxWidth: 360,
            margin: "0 auto",
          }}
        >
          podiumthrows.com/coach/sessions
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* ── App body ───────────────────────────────────────────────────── */}
      <div className="flex" style={{ minHeight: 480 }}>
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div
          className="hidden sm:flex flex-col flex-shrink-0 py-5 px-3"
          style={{
            width: 180,
            background: "var(--landing-surface)",
            borderRight: "1px solid var(--landing-border)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 px-2 mb-7">
            <div
              className="rounded-md flex items-center justify-center flex-shrink-0"
              style={{ width: 22, height: 22, background: "#FFC800" }}
            >
              <span
                className="font-heading"
                style={{ fontSize: 12, fontWeight: 900, color: "#0a0a0a", lineHeight: 1 }}
              >
                P
              </span>
            </div>
            <span
              className="font-heading"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--landing-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Podium
            </span>
          </div>

          {/* Nav */}
          <div className="flex flex-col gap-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item.label}
                className="rounded-md px-2.5 py-2"
                style={{
                  fontSize: 12,
                  fontWeight: item.active ? 600 : 500,
                  color: item.active ? "#FFC800" : "var(--landing-text-muted)",
                  background: item.active ? "var(--landing-amber-glow-strong)" : "transparent",
                  borderLeft: item.active ? "2px solid #FFC800" : "2px solid transparent",
                  letterSpacing: "0.01em",
                }}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Coach footer */}
          <div
            className="mt-auto pt-4 px-1 flex items-center gap-2"
            style={{ borderTop: "1px solid var(--landing-border)" }}
          >
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                width: 24,
                height: 24,
                background: "var(--landing-surface-2)",
                border: "1px solid var(--landing-border)",
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: 9, color: "var(--landing-text-secondary)", fontWeight: 600 }}
              >
                MR
              </span>
            </div>
            <div className="flex flex-col" style={{ lineHeight: 1.2 }}>
              <span style={{ fontSize: 11, color: "var(--landing-text)", fontWeight: 600 }}>
                M. Reyes
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 9, color: "var(--landing-text-dim)", letterSpacing: "0.06em" }}
              >
                COACH · D1
              </span>
            </div>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="flex-1 p-5 sm:p-6" style={{ background: "var(--landing-bg)" }}>
          {/* Page header */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "var(--landing-text-dim)",
                  marginBottom: 4,
                }}
              >
                This week
              </div>
              <h3
                className="font-heading"
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "var(--landing-text)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                Nov 9 — Nov 15
              </h3>
            </div>
            <div
              className="rounded-md px-3 py-1.5 font-heading"
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: "#FFC800",
                color: "#0a0a0a",
                letterSpacing: "0.02em",
              }}
            >
              + New session
            </div>
          </div>

          {/* Day: Mon */}
          <DayBlock day="MON" date="9 NOV">
            <SessionRow
              block="Block 1"
              implements={["9kg", "8kg", "7.26kg"]}
              caption="Heavy → competition"
              dots={[true, true, true, true, true]}
            />
            <SessionRow
              block="Block 2"
              implements={["6kg"]}
              caption="Light, no heavy same day"
              dots={[true, true, true, true]}
            />
            <StrengthRow label="Strength" detail="Snatch 70% · 5×3 · Squat 80% · 4×4" />
          </DayBlock>

          {/* Day: Tue */}
          <DayBlock day="TUE" date="10 NOV" muted>
            <div
              className="font-mono"
              style={{
                fontSize: 12,
                color: "var(--landing-text-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "8px 0",
              }}
            >
              Rest
            </div>
          </DayBlock>

          {/* Day: Wed — VALIDATION REJECTION (the differentiator) */}
          <DayBlock day="WED" date="11 NOV" alert>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.07)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#ef4444",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  ⚠ Sequence rejected
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--landing-text)",
                  lineHeight: 1.55,
                  marginBottom: 6,
                }}
              >
                You proposed{" "}
                <span className="font-mono" style={{ color: "#ef4444", fontWeight: 600 }}>
                  6kg → 8kg
                </span>
                . Ascending sequences caused a 2–4 m loss in every natural athlete Bondarchuk
                studied.
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: "var(--landing-text-secondary)",
                  letterSpacing: "0.04em",
                }}
              >
                Suggested: <span style={{ color: "#FFC800", fontWeight: 600 }}>8kg → 6kg</span> or
                move 6kg to its own day.
              </div>
            </div>
          </DayBlock>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayBlock({
  day,
  date,
  muted = false,
  alert = false,
  children,
}: {
  day: string;
  date: string;
  muted?: boolean;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-3"
      style={{
        borderTop: "1px solid var(--landing-border)",
        paddingTop: 14,
      }}
    >
      <div className="flex items-baseline gap-3 mb-2.5">
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: alert ? "#ef4444" : muted ? "var(--landing-text-dim)" : "var(--landing-text)",
            letterSpacing: "0.18em",
          }}
        >
          {day}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--landing-text-dim)",
            letterSpacing: "0.1em",
          }}
        >
          {date}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SessionRow({
  block,
  implements: imps,
  caption,
  dots,
}: {
  block: string;
  implements: string[];
  caption: string;
  dots: boolean[];
}) {
  return (
    <div
      className="flex items-center gap-4 py-2"
      style={{ borderBottom: "1px dashed var(--landing-border-light)" }}
    >
      <div style={{ width: 64 }}>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--landing-text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {block}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {imps.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="font-mono"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--landing-text)",
                  letterSpacing: "0.01em",
                }}
              >
                {w}
              </span>
              {i < imps.length - 1 && (
                <span style={{ color: "#FFC800", fontSize: 12 }} aria-hidden="true">
                  ▸
                </span>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--landing-text-dim)",
            lineHeight: 1.4,
          }}
        >
          {caption}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {dots.map((filled, i) => (
          <Dot key={i} filled={filled} />
        ))}
      </div>
    </div>
  );
}

function StrengthRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div style={{ width: 64 }}>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--landing-text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>
      <div className="flex-1">
        <span
          className="font-mono"
          style={{
            fontSize: 12,
            color: "var(--landing-text-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          {detail}
        </span>
      </div>
    </div>
  );
}
