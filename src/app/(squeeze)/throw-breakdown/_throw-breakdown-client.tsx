"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

/* Free Throw Breakdown squeeze page.
   One job: capture the email + the throw. Posts to /api/leads with
   source "throw-breakdown"; throw-specific fields ride in deficitResult.
   Colors use --landing-* tokens and text uses size tokens to satisfy
   the app-surface hex + text-size lints (squeeze routes are in scope). */

const EVENTS = [
  { value: "HT", label: "Hammer" },
  { value: "SP", label: "Shot Put" },
  { value: "DT", label: "Discus" },
  { value: "JT", label: "Javelin" },
  { value: "WT", label: "Weight Throw" },
  { value: "multiple", label: "Multiple" },
];

const inputStyle: React.CSSProperties = {
  background: "var(--landing-bg)",
  color: "var(--landing-text)",
  border: "1px solid var(--landing-border-light)",
};
const inputCls = "w-full rounded-[8px] px-3.5 py-3 text-body font-body outline-none";

export function ThrowBreakdownClient() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [event, setEvent] = useState("");
  const [pb, setPb] = useState("");
  const [video, setVideo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || !event || submitting) return;
    setSubmitting(true);
    try {
      const params = new URLSearchParams(window.location.search);
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          email,
          name: firstName || null,
          source: "throw-breakdown",
          event,
          deficitResult: { currentPB: pb, videoLink: video },
          utmSource: params.get("utm_source"),
          utmMedium: params.get("utm_medium"),
          utmCampaign: params.get("utm_campaign"),
        }),
      });
      setSaved(true);
    } catch {
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen font-body"
      style={{ backgroundColor: "var(--landing-bg)", color: "var(--landing-text)" }}
    >
      <header className="py-5 text-center border-b" style={{ borderColor: "var(--landing-border-light)" }}>
        <span className="font-heading font-black uppercase tracking-[0.05em] text-caption">
          PODIUM <span style={{ color: "var(--landing-amber)" }}>THROWS</span>
        </span>
      </header>

      <div className="max-w-[1000px] mx-auto px-6">
        <section className="grid md:grid-cols-2 gap-12 md:gap-14 pt-12 md:pt-16 pb-10">
          {/* Promise */}
          <div>
            <div
              className="font-mono text-caption font-bold uppercase tracking-[0.15em] mb-5"
              style={{ color: "var(--landing-amber)" }}
            >
              Free // Throws Only // Shot · Disc · Hammer · Jav
            </div>
            <h1 className="font-heading font-black uppercase leading-[1.05] text-[clamp(32px,5vw,52px)]">
              Send one throw.<br />Get it broken down by a{" "}
              <span style={{ color: "var(--landing-amber)" }}>D1 coach.</span>
            </h1>
            <p className="mt-6 text-body-lg" style={{ color: "var(--landing-text-secondary)" }}>
              No catch, no PDF. Upload one video and I&apos;ll send back the three things costing you
              distance and the single cue to fix first.
            </p>
            <ul className="mt-7 list-none">
              {[
                "Your #1 technical leak, spotted by a coach who's lived in the ring, not a comment section",
                "One specific cue you can take to practice tomorrow",
                "A straight answer on whether a PR is closer than you think",
              ].map((b) => (
                <li
                  key={b}
                  className="py-3 text-body flex gap-3 border-b"
                  style={{ borderColor: "var(--landing-border-light)" }}
                >
                  <span className="font-mono font-bold" style={{ color: "var(--landing-amber)" }}>+</span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-4">
              <div
                role="img"
                aria-label="Coach Tony Sommers at a track meet"
                className="w-[88px] h-[88px] flex-shrink-0 rounded-full"
                style={{
                  border: "2px solid var(--landing-amber)",
                  backgroundImage: "url('/coach-tony.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                }}
              />
              <div className="text-caption" style={{ color: "var(--landing-text-secondary)" }}>
                <b className="font-heading" style={{ color: "var(--landing-text)" }}>
                  Coach Tony Sommers, M.S.
                </b>
                <br />D1 throws coach. Same system added 4 to 5 meters to every returning hammer thrower
                he coached last season.
              </div>
            </div>
          </div>

          {/* Form card */}
          <div
            className="rounded-[12px] p-8 md:sticky md:top-6 self-start"
            style={{ background: "var(--landing-surface-2)", border: "2px solid var(--landing-amber)" }}
          >
            {saved ? (
              <div className="text-center py-8">
                <div className="font-heading font-black uppercase text-section">Got your throw.</div>
                <p className="mt-3 text-body" style={{ color: "var(--landing-text-secondary)" }}>
                  Check your inbox for confirmation. Your breakdown lands within 48 hours, recorded by
                  me, not a bot.
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-heading font-bold uppercase text-section mb-1.5">
                  Get Your Free Breakdown
                </h2>
                <p className="text-caption mb-6" style={{ color: "var(--landing-text-secondary)" }}>
                  Takes 60 seconds to send. You get a real human reply, not an autoresponder.
                </p>
                <form onSubmit={handleSubmit}>
                  <Field label="First name">
                    <input className={inputCls} style={inputStyle} type="text" placeholder="Jordan"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </Field>
                  <Field label="Email">
                    <input className={inputCls} style={inputStyle} type="email" placeholder="you@email.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </Field>
                  <Field label="Your event">
                    <select className={inputCls} style={inputStyle} value={event}
                      onChange={(e) => setEvent(e.target.value)} required>
                      <option value="" disabled>Select one</option>
                      {EVENTS.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Current PB">
                    <input className={inputCls} style={inputStyle} type="text" placeholder="e.g. 52m / 170ft"
                      value={pb} onChange={(e) => setPb(e.target.value)} required />
                  </Field>
                  <Field label="Link to your throw video">
                    <input className={inputCls} style={inputStyle} type="url"
                      placeholder="YouTube, Drive, or IG link"
                      value={video} onChange={(e) => setVideo(e.target.value)} required />
                  </Field>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-2 cursor-pointer rounded-[10px] border-none font-mono font-bold text-body uppercase tracking-[0.06em] py-4 disabled:opacity-60"
                    style={{ background: "var(--landing-amber)", color: "#000" }}
                  >
                    {submitting ? "Sending…" : "Send My Throw →"}
                  </button>
                </form>
                <p className="mt-3.5 font-mono text-micro text-center" style={{ color: "var(--landing-text-secondary)" }}>
                  <b style={{ color: "var(--landing-amber)" }}>Free.</b> I take the first 10 each month so
                  every one gets real eyes.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Proof strip */}
        <section className="pt-2 pb-16">
          <div
            className="grid sm:grid-cols-3 gap-px rounded-[10px] overflow-hidden"
            style={{ background: "var(--landing-border-light)", border: "1px solid var(--landing-border-light)" }}
          >
            {[
              { big: "5/5", lab: "Returning hammer specialists set lifetime PRs last season" },
              { big: "+5.05m", lab: "Average hammer gain across all five, one season" },
              { big: "4", lab: "NCAA West qualifiers, including a sophomore in both shot and discus" },
            ].map((s) => (
              <div key={s.big} className="p-7" style={{ background: "var(--landing-surface-2)" }}>
                <div
                  className="font-mono font-bold leading-none text-[clamp(28px,4vw,34px)]"
                  style={{ color: "var(--landing-amber)" }}
                >
                  {s.big}
                </div>
                <div className="mt-2.5 text-micro uppercase tracking-[0.09em]" style={{ color: "var(--landing-text-secondary)" }}>
                  {s.lab}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-micro italic" style={{ color: "var(--landing-text-secondary)" }}>
            Marks are public record on TFRRS. Names withheld for athlete privacy.
          </p>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label
        className="block font-mono text-micro uppercase tracking-[0.1em] mb-[7px]"
        style={{ color: "var(--landing-text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
