/* ═══════════════════════════════════════════════════════════════════════════
   CoachingLanding
   ───────────────
   Root landing page sections for Podium Throws Coaching. Leads with the
   verified TFRRS hammer progression story, sells online + San Diego
   in-person coaching, then routes coaches to the platform at /app.
   Marketing surface: forced-dark, --landing-* tokens, hex allowed here.
   All marks sourced from TFRRS, 2025 vs 2026 outdoor season bests.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";
import MonoLabel from "./MonoLabel";

// ─── Verified TFRRS data ──────────────────────────────────────────────────────

interface ResultRow {
  event: string;
  athlete: string;
  note: string;
  best2025: string;
  ft2025: string;
  best2026: string;
  ft2026: string;
  delta: string;
  deltaFt: string;
}

const HAMMER_ROWS: ResultRow[] = [
  {
    event: "Hammer",
    athlete: "Senior, men's",
    note: "lifetime PR",
    best2025: "54.15m",
    ft2025: "177'8\"",
    best2026: "59.65m",
    ft2026: "195'8\"",
    delta: "+5.50m",
    deltaFt: "+18'0\"",
  },
  {
    event: "Hammer",
    athlete: "Senior, women's",
    note: "lifetime PR",
    best2025: "43.72m",
    ft2025: "143'5\"",
    best2026: "49.16m",
    ft2026: "161'3\"",
    delta: "+5.44m",
    deltaFt: "+17'10\"",
  },
  {
    event: "Hammer",
    athlete: "Sophomore, women's",
    note: "lifetime PR",
    best2025: "41.15m",
    ft2025: "135'0\"",
    best2026: "46.39m",
    ft2026: "152'2\"",
    delta: "+5.24m",
    deltaFt: "+17'2\"",
  },
  {
    event: "Hammer",
    athlete: "Junior, women's",
    note: "lifetime PR",
    best2025: "42.00m",
    ft2025: "137'10\"",
    best2026: "46.62m",
    ft2026: "152'11\"",
    delta: "+4.62m",
    deltaFt: "+15'2\"",
  },
  {
    event: "Hammer",
    athlete: "Sophomore, men's",
    note: "lifetime PR",
    best2025: "48.70m",
    ft2025: "159'9\"",
    best2026: "53.14m",
    ft2026: "174'4\"",
    delta: "+4.44m",
    deltaFt: "+14'7\"",
  },
];

const MAILTO =
  "mailto:toncamedia@gmail.com?subject=Founding%20Athlete%20Spot&body=Event%3A%0ACurrent%20PB%3A%0AGoal%3A";

// ─── Shared bits ──────────────────────────────────────────────────────────────

function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <>
      {/* Mobile: stacked cards. A 5-column table can't fit a phone, and the
          desktop table hides the athlete column on small screens — which left
          the header and body misaligned. Cards restore the athlete context. */}
      <div className="space-y-3 sm:hidden">
        {rows.map((r, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--landing-border-light)] bg-[var(--landing-surface)] p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-heading font-bold uppercase text-[15px]">{r.event}</span>
              <span className="font-mono font-bold tabular-nums text-[18px] text-[var(--landing-amber)]">
                {r.delta}
                <span className="ml-1.5 text-[11px] font-normal text-[var(--landing-text-secondary)]">
                  {r.deltaFt}
                </span>
              </span>
            </div>
            <div className="mt-1 text-[12px] text-[var(--landing-text-secondary)]">
              {r.athlete} · {r.note}
            </div>
            <div className="mt-3 flex items-center gap-4 font-mono tabular-nums">
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--landing-text-secondary)]">
                  2025
                </div>
                <div className="text-[16px]">{r.best2025}</div>
                <div className="text-[11px] text-[var(--landing-text-secondary)]">{r.ft2025}</div>
              </div>
              <span className="text-[18px] text-[var(--landing-amber)]" aria-hidden="true">
                →
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--landing-text-secondary)]">
                  2026
                </div>
                <div className="text-[16px]">{r.best2026}</div>
                <div className="text-[11px] text-[var(--landing-text-secondary)]">{r.ft2026}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Event", "Athlete", "2025 Best", "2026 Best", "Change"].map((h) => (
                <th
                  key={h}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-left px-4 py-3 border-b-2 border-[var(--landing-amber)] text-[var(--landing-text-secondary)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-4 border-b border-[var(--landing-border-light)]">
                  {r.event}
                </td>
                <td className="px-4 py-4 border-b border-[var(--landing-border-light)] hidden sm:table-cell">
                  {r.athlete}
                  <span className="block text-[13px] text-[var(--landing-text-secondary)]">
                    {r.note}
                  </span>
                </td>
                <td className="px-4 py-4 border-b border-[var(--landing-border-light)] font-mono tabular-nums">
                  {r.best2025}
                  <span className="block text-xs text-[var(--landing-text-secondary)]">
                    {r.ft2025}
                  </span>
                </td>
                <td className="px-4 py-4 border-b border-[var(--landing-border-light)] font-mono tabular-nums">
                  {r.best2026}
                  <span className="block text-xs text-[var(--landing-text-secondary)]">
                    {r.ft2026}
                  </span>
                </td>
                <td className="px-4 py-4 border-b border-[var(--landing-border-light)] font-mono tabular-nums font-bold text-[var(--landing-amber)]">
                  {r.delta}
                  <span className="block text-xs font-normal text-[var(--landing-text-secondary)]">
                    {r.deltaFt}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-block rounded-[10px] bg-[var(--landing-amber)] text-black font-mono font-bold text-sm uppercase tracking-[0.08em] px-8 py-4 hover:brightness-110 transition"
    >
      {children}
    </a>
  );
}

// ─── Page sections ────────────────────────────────────────────────────────────

export default function CoachingLanding() {
  return (
    <main className="pt-[90px]">
      {/* Hero */}
      <section className="max-w-[1060px] mx-auto px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <ScrollReveal>
          <MonoLabel>Podium Throws Coaching // Hammer · Shot Put · Discus</MonoLabel>
          <h1 className="font-heading font-black uppercase leading-[1.04] text-[clamp(40px,6vw,68px)] max-w-[850px] mt-5">
            Every returning hammer specialist gained{" "}
            <span className="text-[var(--landing-amber)]">4.4 to 5.5 meters.</span>
          </h1>
          <p className="mt-7 text-lg text-[var(--landing-text-secondary)] max-w-[640px]">
            One season with a D1 throws squad. All five returning hammer specialists averaged a
            five-meter gain (over 16 feet), and every one of them set a lifetime PR. The numbers
            below are public record. Now I&apos;m taking 6 remote athletes.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <PrimaryCta href="#apply">Apply for a Founding Spot</PrimaryCta>
            <span className="font-mono text-xs text-[var(--landing-text-secondary)]">
              <b className="text-[var(--landing-amber)]">6 founding spots</b> · $199/mo locked for
              life
            </span>
          </div>
        </ScrollReveal>
      </section>

      {/* Hammer results */}
      <section id="results" className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)]">
              The Hammer Story
            </h2>
            <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-3 mb-10">
              2025 outdoor season best vs. 2026 outdoor season best. Every returning athlete whose
              primary discipline is hammer, one year of my programming. Verified on TFRRS. (The
              squad&apos;s shot/discus specialist also threw hammer as a third event and added
              0.84m, a lifetime PR.)
            </p>
            <ResultsTable rows={HAMMER_ROWS} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--landing-border-light)] border border-[var(--landing-border-light)] mt-12 rounded-[10px] overflow-hidden">
              {[
                { big: "5/5", label: "Returning hammer specialists who set lifetime PRs in 2026" },
                {
                  big: "+5.05m",
                  sub: "16'7\"",
                  label: "Average hammer gain across all five, in one season",
                },
                {
                  big: "+25.24m",
                  sub: "82'10\"",
                  label: "Combined hammer meters added to the squad",
                },
              ].map((s) => (
                <div key={s.big} className="bg-[var(--landing-surface)] p-7">
                  <div className="font-mono font-bold text-[clamp(30px,4vw,44px)] leading-none text-[var(--landing-amber)]">
                    {s.big}
                    {s.sub && (
                      <span className="block text-xs font-normal text-[var(--landing-text-secondary)] mt-1">
                        {s.sub}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-[13px] uppercase tracking-[0.1em] text-[var(--landing-text-secondary)]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-7 text-[13px] italic text-[var(--landing-text-secondary)] max-w-[720px]">
              It wasn&apos;t just hammer. Across shot and discus, returning throwers added another
              7.86m combined, including a Big West discus runner-up (+1.99m). Four of the throwers
              qualified for the NCAA West First Round, among them a sophomore who qualified in both
              shot and discus.
            </p>
            <p className="mt-4 text-[13px] italic text-[var(--landing-text-secondary)] max-w-[720px]">
              All marks are outdoor season bests pulled from TFRRS (tfrrs.org), comparing each
              returning athlete&apos;s 2025 and 2026 seasons. Names withheld for athlete privacy.
              Full transparency: across all 18 event-season comparisons on the squad, 13 improved
              and 5 declined (mostly secondary events, the largest a 1.13m dip in javelin). Athletes
              did the work; my job was the plan. Improvement in sport is always multi-factor and I
              won&apos;t pretend otherwise. But five hammer throwers gaining five meters in the same
              year is not luck. It&apos;s a system.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Lead magnet: Free Throw Breakdown */}
      <section id="free-breakdown" className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-20">
          <ScrollReveal>
            <div className="rounded-[12px] border-2 border-[var(--landing-amber)] bg-[var(--landing-surface)] p-10 sm:p-12">
              <MonoLabel>Free // Personal // Not a PDF</MonoLabel>
              <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)] mt-1">
                Send Me One Throw. I&apos;ll Break It Down.
              </h2>
              <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-3 mb-8">
                Not ready to commit, fair. Send one video of your throw and I&apos;ll send back a
                personal breakdown: the three things costing you distance and the one cue to fix
                first. Real human reply within 48 hours, no autoresponder. It&apos;s the closest thing
                to a free session you&apos;ll get from a D1 coach.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/throw-breakdown"
                  className="inline-block rounded-[10px] bg-[var(--landing-amber)] text-black font-mono font-bold text-sm uppercase tracking-[0.08em] px-8 py-4 hover:brightness-110 transition"
                >
                  Get My Free Breakdown
                </Link>
                <span className="font-mono text-xs text-[var(--landing-text-secondary)]">
                  First <b className="text-[var(--landing-amber)]">10 each month</b> &middot; so every one gets real eyes
                </span>
              </div>
              <p className="mt-6 text-[13px] italic text-[var(--landing-text-secondary)]">
                Prefer instant? Run the self-serve{" "}
                <Link href="/deficit-finder" className="text-[var(--landing-amber)] underline">
                  Deficit Finder
                </Link>{" "}
                for a quick read on where your transfer is breaking down. No signup.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Method */}
      <section className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)]">
              How It Works
            </h2>
            <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-3 mb-10">
              No generic templates. Your training is built on Dr. Anatoliy Bondarchuk&apos;s
              Transfer of Training research: the same system behind the tables above.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--landing-border-light)] border border-[var(--landing-border-light)] rounded-[10px] overflow-hidden">
              {[
                {
                  n: "01",
                  h: "Monthly Programming",
                  p: "A full training plan built around your event, your level, and your meet calendar. Exercise selection driven by correlation data, not gym-bro tradition. Implement weights sequenced heavy-to-light the way the research says they should be.",
                },
                {
                  n: "02",
                  h: "Film Review, 48-Hour Turnaround",
                  p: "Upload a session, get it back within 48 hours. Frame-by-frame technical breakdown with specific cues and the one fix that matters this week, not twelve things to think about in the ring.",
                },
                {
                  n: "03",
                  h: "Async Q&A",
                  p: "Stuck on a cue, unsure about an adjustment, meet-week nerves: message me and I reply within 24 hours on weekdays. No waiting for next month's call.",
                },
                {
                  n: "04",
                  h: "Everything In One Place",
                  p: "Training, film, and progress tracking delivered through the Podium Throws platform. You see exactly what to do today and how your numbers trend over the season.",
                },
              ].map((c) => (
                <div key={c.n} className="bg-[var(--landing-bg)] p-8">
                  <div className="font-mono font-bold text-[13px] text-[var(--landing-amber)]">
                    {c.n}
                  </div>
                  <h3 className="font-heading font-bold uppercase text-lg mt-3 mb-2">{c.h}</h3>
                  <p className="text-[15px] text-[var(--landing-text-secondary)]">{c.p}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Offer */}
      <section id="apply" className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)]">
              Founding Athlete Offer
            </h2>
            <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-3 mb-10">
              I&apos;m opening 6 spots at the founding rate. It stays your rate for as long as you
              train with me, even after the price goes up.
            </p>
            <div className="rounded-[12px] border-2 border-[var(--landing-amber)] bg-[var(--landing-surface)] p-6 sm:p-10 md:p-12">
              <div className="font-mono font-bold text-[40px] sm:text-[54px] leading-none text-[var(--landing-amber)]">
                $199
                <span className="text-[15px] sm:text-[17px] font-normal text-[var(--landing-text-secondary)]">
                  /mo
                </span>
                <span className="ml-2 sm:ml-3 text-[18px] sm:text-[22px] line-through font-normal text-[var(--landing-text-secondary)]">
                  $249/mo
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 mt-9">
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--landing-text-secondary)] mb-2">
                    You Get
                  </h4>
                  <ul>
                    {[
                      "Individualized monthly program (Bondarchuk method)",
                      "Film review on every session you upload, back within 48 hours",
                      "Async Q&A, weekday replies within 24 hours",
                      "Podium Throws Elite included ($50/mo value)",
                      "Founding rate locked for life",
                    ].map((li) => (
                      <li
                        key={li}
                        className="py-2.5 border-b border-[var(--landing-border-light)] text-[15px]"
                      >
                        <span className="text-[var(--landing-amber)] font-mono">→ </span>
                        {li}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--landing-text-secondary)] mb-2">
                    How To Claim It
                  </h4>
                  <ul>
                    {[
                      "Email toncamedia@gmail.com with your event and current PB",
                      "Or DM @tonysommers.coach on Instagram",
                      "15-minute call to confirm fit, no pitch theater",
                      "First program delivered within 7 days",
                    ].map((li) => (
                      <li
                        key={li}
                        className="py-2.5 border-b border-[var(--landing-border-light)] text-[15px]"
                      >
                        <span className="text-[var(--landing-amber)] font-mono">→ </span>
                        {li}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    <PrimaryCta href={MAILTO}>Email Me Your Event + PB</PrimaryCta>
                  </div>
                </div>
              </div>
            </div>

            {/* In-person: San Diego */}
            <div className="mt-12 rounded-[12px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 sm:p-10">
              <MonoLabel>San Diego Locals // In-Person Training</MonoLabel>
              <h3 className="font-heading font-black uppercase text-[26px] mt-2">
                Train With Me In Person
              </h3>
              <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-2 mb-6">
                Limited in-person spots for San Diego County throwers. Same system, hands-on in the
                ring.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--landing-text-secondary)] mb-2">
                    Group Sessions
                  </h4>
                  <div className="font-mono font-bold text-[38px] leading-none text-[var(--landing-amber)]">
                    $65
                    <span className="text-[15px] font-normal text-[var(--landing-text-secondary)]">
                      /athlete
                    </span>
                  </div>
                  <ul className="mt-4">
                    {[
                      "Small group, max 6 throwers per session",
                      "Shot put, discus, and hammer blocks",
                      "Every rep filmed and reviewed on the spot",
                    ].map((li) => (
                      <li
                        key={li}
                        className="py-2.5 border-b border-[var(--landing-border-light)] text-[15px]"
                      >
                        <span className="text-[var(--landing-amber)] font-mono">→ </span>
                        {li}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--landing-text-secondary)] mb-2">
                    Private Sessions
                  </h4>
                  <div className="font-mono font-bold text-[38px] leading-none text-[var(--landing-amber)]">
                    $120
                    <span className="text-[15px] font-normal text-[var(--landing-text-secondary)]">
                      /hr
                    </span>
                  </div>
                  <ul className="mt-4">
                    {[
                      "One-on-one technical work, your event only",
                      "Session film breakdown included",
                      "Best paired with the monthly online program",
                    ].map((li) => (
                      <li
                        key={li}
                        className="py-2.5 border-b border-[var(--landing-border-light)] text-[15px]"
                      >
                        <span className="text-[var(--landing-amber)] font-mono">→ </span>
                        {li}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-6 text-[13px] italic text-[var(--landing-text-secondary)]">
                Sessions at San Diego County facilities. Email or DM for the current schedule and
                locations.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Fit */}
      <section className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)] mb-10">
              Who This Is For
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--landing-border-light)] border border-[var(--landing-border-light)] rounded-[10px] overflow-hidden">
              <div className="bg-[var(--landing-bg)] p-8">
                <h3 className="font-heading font-bold uppercase text-[17px] text-[var(--landing-amber)] mb-4">
                  Good Fit
                </h3>
                <ul>
                  {[
                    "High school throwers chasing college marks",
                    "College throwers without a dedicated throws coach",
                    "Post-collegiate and masters throwers still competing",
                    "Athletes who will film their throws and follow a plan",
                  ].map((li) => (
                    <li key={li} className="py-2 text-[15px]">
                      <span className="text-[var(--landing-amber)] font-mono font-bold">+ </span>
                      {li}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[var(--landing-bg)] p-8">
                <h3 className="font-heading font-bold uppercase text-[17px] text-[var(--landing-text-secondary)] mb-4">
                  Bad Fit
                </h3>
                <ul>
                  {[
                    "Looking for a hype man, not a coach",
                    "Won't film training or report numbers",
                    "Want a magic fix instead of a system",
                    "Program-hoppers who change plans every 3 weeks",
                  ].map((li) => (
                    <li key={li} className="py-2 text-[15px] text-[var(--landing-text-secondary)]">
                      <span className="font-mono">− </span>
                      {li}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Platform bridge → /app */}
      <section id="platform" className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <MonoLabel>The Platform // For Coaches</MonoLabel>
            <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)] mt-3">
              Coach Your Own Squad With The Same System
            </h2>
            <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-3 mb-10">
              Everything behind the results above runs on the Podium Throws app: Bondarchuk
              implement-sequencing validation, session building, and performance tracking for shot,
              disc, hammer, and javelin. Coaches start free, no card required.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="inline-block rounded-[10px] bg-[var(--landing-amber)] text-black font-mono font-bold text-sm uppercase tracking-[0.08em] px-8 py-4 hover:brightness-110 transition"
              >
                Explore the App
              </Link>
              <Link
                href="/register"
                className="inline-block rounded-[10px] border-2 border-[var(--landing-border)] text-[var(--landing-text)] font-mono font-bold text-sm uppercase tracking-[0.08em] px-8 py-4 hover:border-[var(--landing-amber)] hover:text-[var(--landing-amber)] transition"
              >
                Start Free
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8 sm:gap-12 items-start">
              <div>
                <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)] mb-5">
                  Who&apos;s Coaching You
                </h2>
                <p className="mb-4">
                  I&apos;m Tony Sommers. I coached the throws squad at a Division I program through
                  the 2026 season, where the results above happened. Before that: M.S. in Movement
                  Science from the University of Michigan, and years in the ring myself.
                </p>
                <p className="mb-4">
                  I still compete. I&apos;m a left-handed hammer thrower chasing 75 meters, which
                  means every method I prescribe gets tested on me first. I also lecture in
                  kinesiology at the university level, so I can explain the why behind every
                  exercise, not just hand you sets and reps.
                </p>
                <p>
                  My system is built on Bondarchuk&apos;s Transfer of Training: exercises ranked by
                  how much they actually correlate with throwing far, periodized so you peak when it
                  counts. It&apos;s the difference between training hard and training in the right
                  direction.
                </p>
              </div>
              <ul className="border-l-2 border-[var(--landing-amber)] pl-6 font-mono text-[13px] text-[var(--landing-text-secondary)]">
                {[
                  "// D1 throws coach, 2025-26",
                  "// M.S. Movement Science, Michigan",
                  "// Kinesiology lecturer, CSUSM",
                  "// Builder, Podium Throws",
                  "// Active hammer thrower",
                ].map((li) => (
                  <li key={li} className="py-2">
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--landing-border-light)]">
        <div className="max-w-[1060px] mx-auto px-6 py-14 sm:py-20">
          <ScrollReveal>
            <h2 className="font-heading font-black uppercase text-[clamp(26px,3.6vw,38px)]">
              Six Spots. Then the Price Goes Up.
            </h2>
            <p className="text-[var(--landing-text-secondary)] max-w-[640px] mt-3 mb-9">
              If you throw shot, disc, or hammer and you&apos;re serious about next season, the
              off-season starts now.
            </p>
            <PrimaryCta href={MAILTO}>Claim a Founding Spot</PrimaryCta>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
