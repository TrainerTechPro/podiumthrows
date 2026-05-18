import type { Metadata } from "next";
import MarketingNav from "@/components/marketing/Nav";
import HeroSection from "@/components/marketing/HeroSection";
import BondarchukProof from "@/components/marketing/BondarchukProof";
import StickyFeatures from "@/components/marketing/StickyFeatures";
import BentoFeatures from "@/components/marketing/BentoFeatures";
import DeficitFinderCTA from "@/components/marketing/DeficitFinderCTA";
import PricingPreview from "@/components/marketing/PricingPreview";
import FinalCTA from "@/components/marketing/FinalCTA";
import MarketingFooter from "@/components/marketing/Footer";

const OG_HOME =
  "/api/og?title=Podium%20Throws&description=The%20coaching%20platform%20built%20around%20Bondarchuk%20methodology";

export const metadata: Metadata = {
  title: "Podium Throws — The Coaching Platform Built for Throws",
  description:
    "The coaching platform built around Bondarchuk methodology. Session validation and performance tracking for shot put, discus, hammer, and javelin coaches.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Podium Throws — The Coaching Platform Built for Throws",
    description:
      "The coaching platform built around Bondarchuk methodology. Session validation and performance tracking for throws coaches.",
    type: "website",
    images: [
      {
        url: OG_HOME,
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
      "Session validation and performance tracking for throws coaches. Built around Bondarchuk methodology.",
    images: [OG_HOME],
  },
};

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
      <MarketingNav />
      <HeroSection />
      <BondarchukProof />
      <StickyFeatures />
      <BentoFeatures />
      <DeficitFinderCTA />
      <PricingPreview />
      <FinalCTA />
      <MarketingFooter />
    </div>
  );
}
