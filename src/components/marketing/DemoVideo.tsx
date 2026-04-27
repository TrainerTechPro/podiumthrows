"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { track } from "@/lib/analytics";

type Provider = "loom" | "youtube" | "placeholder";

type Props = {
  /** Loom video id (the bit after /share/) or YouTube video id. Omit for the placeholder card. */
  videoId?: string;
  provider?: Provider;
  /** Title used for screen readers and the iframe title attribute. */
  title?: string;
  /** Analytics surface tag — distinguishes multiple embeds across the site. */
  placement?: string;
  /** Optional poster image URL for the unplayed state. */
  posterSrc?: string;
};

const PROVIDER_EMBED: Record<Exclude<Provider, "placeholder">, (id: string) => string> = {
  loom: (id) =>
    `https://www.loom.com/embed/${id}?autoplay=1&hide_owner=1&hide_share=1&hide_title=1`,
  youtube: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
};

export default function DemoVideo({
  videoId,
  provider = videoId ? "loom" : "placeholder",
  title = "Podium Throws — 90-second product tour",
  placement = "landing_above_features",
  posterSrc,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const playedOnceRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handlePlay() {
    const firstPlay = !playedOnceRef.current;
    playedOnceRef.current = true;
    setPlaying(true);
    track("demo_video_played", {
      placement,
      videoId: videoId ?? "placeholder",
      firstPlay,
    });
  }

  const showIframe = playing && provider !== "placeholder" && videoId;

  return (
    <section
      aria-label="Product demo video"
      style={{
        position: "relative",
        width: "100%",
        paddingTop: 64,
        paddingBottom: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 20px",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <p
            className="font-heading"
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--landing-text-dim)",
              marginBottom: 14,
            }}
          >
            90-Second Tour
          </p>
          <h2
            className="font-heading font-black"
            style={{
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--landing-text)",
              marginBottom: 28,
            }}
          >
            See it in motion.
          </h2>

          <div
            ref={containerRef}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid var(--landing-border)",
              background: "var(--landing-bg)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px var(--landing-border-light) inset",
            }}
          >
            {showIframe ? (
              <iframe
                src={PROVIDER_EMBED[provider as "loom" | "youtube"](videoId!)}
                title={title}
                loading="lazy"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                disabled={!inView && provider !== "placeholder"}
                aria-label={`Play ${title}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  cursor: provider === "placeholder" ? "default" : "pointer",
                  background: posterSrc
                    ? `url(${posterSrc}) center/cover`
                    : "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,200,0,0.10), transparent 70%), var(--landing-bg)",
                  border: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--landing-text)",
                  transition: "transform 200ms ease-out",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    background: "var(--brand-color, #FFC800)",
                    color: "#0a0a0a",
                    boxShadow: "0 0 60px rgba(255,200,0,0.35), 0 0 0 8px rgba(255,200,0,0.10)",
                  }}
                >
                  <Play strokeWidth={2.25} size={32} fill="currentColor" aria-hidden="true" />
                </span>

                {provider === "placeholder" && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 18,
                      left: 0,
                      right: 0,
                      fontSize: 12,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--landing-text-dim)",
                    }}
                  >
                    Demo coming soon
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
