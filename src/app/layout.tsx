import type { Metadata, Viewport } from "next";
import { Chakra_Petch, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { ServiceWorkerProvider } from "@/components/pwa/ServiceWorkerProvider";
import { Analytics } from "@vercel/analytics/next";
import { WebVitalsReporter } from "./web-vitals";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  variable: "--font-chakra-petch",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
};

export const metadata: Metadata = {
  title: "Podium Throws — Elite Throws Coaching Platform",
  description:
    "The coaching platform built for Olympic-level track & field throws coaches. Manage athletes, plan training, and track performance across shot put, discus, hammer, and javelin.",
  keywords: [
    "throws coaching",
    "track and field",
    "shot put",
    "discus",
    "hammer throw",
    "javelin",
    "Bondarchuk",
    "training management",
  ],
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.webmanifest",
  applicationName: "Podium Throws",
  appleWebApp: {
    capable: true,
    title: "Podium",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Podium Throws — Elite Throws Coaching Platform",
    description: "The coaching platform built for Olympic-level track & field throws coaches.",
    url: APP_URL,
    siteName: "Podium Throws",
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630, alt: "Podium Throws" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Podium Throws — Elite Throws Coaching Platform",
    description: "The coaching platform built for Olympic-level track & field throws coaches.",
    images: [`${APP_URL}/api/og`],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  // If the user has explicitly chosen a theme, honor it. Otherwise leave
  // the class unset on the server and let the pre-paint script below pick
  // the right class from prefers-color-scheme. Dark is no longer the
  // universal default — outdoor athletes and first-time coach evaluators
  // are better served by respecting system preference.
  const explicitClass = theme === "dark" ? " dark" : theme === "light" ? "" : "";
  const hasExplicitTheme = theme === "dark" || theme === "light";

  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${dmSans.variable} ${ibmPlexMono.variable}${explicitClass}`}
      suppressHydrationWarning
    >
      <head>
        {!hasExplicitTheme && (
          <Script id="theme-init" strategy="beforeInteractive">
            {`(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(e){}})();`}
          </Script>
        )}
      </head>
      <body>
        <ServiceWorkerProvider>{children}</ServiceWorkerProvider>
        <WebVitalsReporter />
        <Analytics />
        {process.env.NODE_ENV !== "production" && (
          <>
            <Script
              src="https://skills-pearl.vercel.app/budge.iife.js"
              strategy="afterInteractive"
            />
            <div
              data-budge={JSON.stringify({
                slides: [
                  {
                    label: "size",
                    property: "width",
                    min: 24,
                    max: 56,
                    value: 36,
                    original: 44,
                    unit: "px",
                  },
                  {
                    label: "icon",
                    property: "font-size",
                    min: 12,
                    max: 28,
                    value: 18,
                    original: 20,
                    unit: "px",
                  },
                  {
                    label: "glow",
                    property: "box-shadow",
                    min: 0,
                    max: 30,
                    value: 14,
                    original: 14,
                    unit: "px",
                  },
                ],
              })}
              hidden
            />
          </>
        )}
      </body>
    </html>
  );
}
