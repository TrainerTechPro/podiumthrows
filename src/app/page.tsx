import type { Metadata } from "next";
import MarketingNav from "@/components/marketing/Nav";
import HeroSection from "@/components/marketing/HeroSection";
import DataStrip from "@/components/marketing/DataStrip";
import DemoVideo from "@/components/marketing/DemoVideo";
import BondarchukProof from "@/components/marketing/BondarchukProof";
import StickyFeatures from "@/components/marketing/StickyFeatures";
import BentoFeatures from "@/components/marketing/BentoFeatures";
import DeficitFinderCTA from "@/components/marketing/DeficitFinderCTA";
import PricingPreview from "@/components/marketing/PricingPreview";
import FinalCTA from "@/components/marketing/FinalCTA";
import MarketingFooter from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Podium Throws — The Coaching Platform Built for Throws",
  description:
    "The only coaching platform that enforces Bondarchuk methodology. Session validation, video analysis, and performance tracking for shot put, discus, hammer, and javelin coaches.",
  openGraph: {
    title: "Podium Throws — The Coaching Platform Built for Throws",
    description:
      "The only coaching platform that enforces Bondarchuk methodology. Session validation, video analysis, and performance tracking.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Podium Throws — The Coaching Platform Built for Throws",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Podium Throws — The Coaching Platform Built for Throws",
    description:
      "Session validation, video analysis, and performance tracking for throws coaches. Built on Bondarchuk methodology.",
  },
};

function Divider() {
  return (
    <div
      className="h-px max-w-[1400px] mx-auto"
      style={{ backgroundColor: "var(--landing-border)" }}
      aria-hidden="true"
    />
  );
}

export default function HomePage() {
  return (
    <div
      className="dark landing-grain min-h-screen font-body selection:bg-primary-500/30 selection:text-white"
      style={{
        backgroundColor: "var(--landing-bg)",
        color: "var(--landing-text)",
        position: "relative",
      }}
    >
      {/* Engineering grid background */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(var(--landing-amber-glow) 1px, transparent 1px), linear-gradient(90deg, var(--landing-amber-glow) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <MarketingNav />
        <HeroSection />
        <DataStrip />
        <Divider />
        <DemoVideo placement="landing_above_features" />
        <Divider />
        <StickyFeatures />
        <Divider />
        <BentoFeatures />
        <Divider />
        <BondarchukProof />
        <Divider />
        <DeficitFinderCTA />
        <Divider />
        <PricingPreview />
        <Divider />
        <FinalCTA />
        <MarketingFooter />
      </div>
    </div>
  );
}
