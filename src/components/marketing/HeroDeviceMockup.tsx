"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroDeviceMockup
   ────────────────
   A purely visual, code-rendered browser chrome frame containing a miniature
   Podium Throws coach dashboard. No images — all HTML/CSS/SVG. Uses
   `var(--landing-*)` tokens for color.
   ═══════════════════════════════════════════════════════════════════════════ */

const SIDEBAR_ITEMS = [
  { label: "Dashboard", active: true },
  { label: "Athletes", active: false },
  { label: "Sessions", active: false },
  { label: "Videos", active: false },
  { label: "Programming", active: false },
  { label: "Codex", active: false },
];

const STAT_CARDS = [
  { label: "Athletes", value: "14", sub: null, subColor: "" },
  { label: "This Week", value: "8", sub: "sessions", subColor: "" },
  { label: "Avg Dist", value: "17.2m", sub: "+0.4m", subColor: "#22c55e" },
  { label: "PRs", value: "3", sub: "this month", subColor: "#22c55e" },
];

const ATHLETES = [
  { initials: "JM", name: "J. Martinez", event: "Shot Put", best: "18.42m", trend: "PR", trendType: "pr" as const },
  { initials: "KW", name: "K. Williams", event: "Discus", best: "54.1m", trend: "+1.2m", trendType: "up" as const },
  { initials: "TS", name: "T. Smith", event: "Hammer", best: "62.8m", trend: "Steady", trendType: "steady" as const },
];

// SVG chart points — rising trend
const CHART_POINTS = "0,55 40,48 80,50 120,42 160,38 200,35 240,30 280,28 320,22 360,18 400,12";
const CHART_AREA = `0,65 ${CHART_POINTS} 400,65`;

export default function HeroDeviceMockup() {
  return (
    <div
      className="w-full select-none"
      style={{
        borderRadius: 14,
        border: "1px solid var(--landing-border)",
        boxShadow:
          "0 80px 160px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
        overflow: "hidden",
        background: "var(--landing-bg)",
      }}
      aria-hidden="true"
    >
      {/* ── Browser chrome bar ──────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3.5 py-2"
        style={{ background: "var(--landing-surface)" }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-[6px] flex-shrink-0">
          <span className="block rounded-full" style={{ width: 8, height: 8, background: "#ff5f57" }} />
          <span className="block rounded-full" style={{ width: 8, height: 8, background: "#febc2e" }} />
          <span className="block rounded-full" style={{ width: 8, height: 8, background: "#28c840" }} />
        </div>

        {/* URL bar */}
        <div
          className="flex-1 mx-2 rounded-md px-3 py-[3px] text-center"
          style={{
            background: "var(--landing-surface-2)",
            fontSize: 10,
            color: "var(--landing-text-muted)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          podiumthrows.com/coach/dashboard
        </div>
      </div>

      {/* ── Main content area ───────────────────────────────────────── */}
      <div className="flex" style={{ minHeight: 260 }}>
        {/* Sidebar */}
        <div
          className="flex-shrink-0 py-3 px-2.5 hidden sm:block"
          style={{
            width: 120,
            background: "var(--landing-surface)",
            borderRight: "1px solid var(--landing-border)",
          }}
        >
          {/* Sidebar header */}
          <div className="flex items-center gap-1.5 px-1.5 mb-3">
            <div
              className="rounded flex items-center justify-center flex-shrink-0"
              style={{ width: 14, height: 14, background: "#f59e0b" }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#0a0a0a",
                  lineHeight: 1,
                  fontFamily: "var(--font-outfit), system-ui, sans-serif",
                }}
              >
                P
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--landing-text)",
                fontFamily: "var(--font-outfit), system-ui, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              Podium
            </span>
          </div>

          {/* Nav items */}
          <div className="flex flex-col gap-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item.label}
                className="rounded px-2 py-[4px]"
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  color: item.active ? "#f59e0b" : "var(--landing-text-muted)",
                  fontWeight: item.active ? 600 : 400,
                  background: item.active ? "var(--landing-amber-glow-strong)" : "transparent",
                  boxShadow: item.active ? "inset 0 0 12px rgba(245,158,11,0.08)" : "none",
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard content */}
        <div className="flex-1 p-3 sm:p-4 overflow-hidden" style={{ background: "var(--landing-bg)" }}>
          {/* Stat cards row */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
            {STAT_CARDS.map((card) => (
              <div
                key={card.label}
                className="rounded-md px-2 py-1.5 sm:py-2"
                style={{
                  background: "var(--landing-surface)",
                  border: "1px solid var(--landing-border)",
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    color: "var(--landing-text-muted)",
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--landing-text)",
                    fontFamily: "var(--font-outfit), system-ui, sans-serif",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {card.value}
                </div>
                {card.sub && (
                  <div
                    style={{
                      fontSize: 8,
                      color: card.subColor || "var(--landing-text-muted)",
                      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                      marginTop: 1,
                    }}
                  >
                    {card.sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Performance chart */}
          <div
            className="rounded-md mb-3 px-2 py-2"
            style={{
              background: "var(--landing-surface)",
              border: "1px solid var(--landing-border)",
            }}
          >
            <div
              style={{
                fontSize: 8,
                color: "var(--landing-text-muted)",
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Performance Trend
            </div>
            <svg
              viewBox="0 0 400 65"
              className="w-full"
              preserveAspectRatio="none"
              style={{ display: "block" }}
            >
              <defs>
                <linearGradient id="hero-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Fill area */}
              <polygon
                points={CHART_AREA}
                fill="url(#hero-chart-fill)"
              />
              {/* Line */}
              <polyline
                points={CHART_POINTS}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* End dot */}
              <circle cx="400" cy="12" r="3" fill="#f59e0b" />
              <circle cx="400" cy="12" r="5" fill="#f59e0b" opacity="0.2" />
            </svg>
          </div>

          {/* Athlete table */}
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: "var(--landing-surface)",
              border: "1px solid var(--landing-border)",
            }}
          >
            {/* Header row */}
            <div
              className="grid px-2 py-1.5"
              style={{
                gridTemplateColumns: "1fr 0.7fr 0.5fr 0.5fr",
                borderBottom: "1px solid var(--landing-border)",
              }}
            >
              {["ATHLETE", "EVENT", "BEST", "TREND"].map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 7,
                    fontWeight: 600,
                    color: "var(--landing-text-dim)",
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {ATHLETES.map((athlete, i) => (
              <div
                key={athlete.initials}
                className="grid items-center px-2 py-1.5"
                style={{
                  gridTemplateColumns: "1fr 0.7fr 0.5fr 0.5fr",
                  borderBottom: i < ATHLETES.length - 1 ? "1px solid var(--landing-border)" : "none",
                }}
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-1.5">
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 16,
                      height: 16,
                      background: "var(--landing-surface-2)",
                      border: "1px solid var(--landing-border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 6,
                        fontWeight: 600,
                        color: "var(--landing-text-muted)",
                        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                      }}
                    >
                      {athlete.initials}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: "var(--landing-text)",
                      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    }}
                  >
                    {athlete.name}
                  </span>
                </div>

                {/* Event */}
                <span
                  style={{
                    fontSize: 9,
                    color: "var(--landing-text-secondary)",
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  }}
                >
                  {athlete.event}
                </span>

                {/* Best */}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--landing-text)",
                    fontFamily: "var(--font-outfit), system-ui, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {athlete.best}
                </span>

                {/* Trend badge */}
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 self-center"
                  style={{
                    fontSize: 7,
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    ...(athlete.trendType === "pr"
                      ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
                      : athlete.trendType === "up"
                        ? { background: "rgba(34,197,94,0.1)", color: "#4ade80" }
                        : { background: "var(--landing-surface-2)", color: "var(--landing-text-muted)" }),
                  }}
                >
                  {athlete.trendType === "pr" && "PR \u2191"}
                  {athlete.trendType === "up" && athlete.trend}
                  {athlete.trendType === "steady" && athlete.trend}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
