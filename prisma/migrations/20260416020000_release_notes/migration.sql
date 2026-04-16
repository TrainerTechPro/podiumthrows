-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenReleaseSlug" TEXT;

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bullets" JSONB NOT NULL,
    "ctaText" TEXT,
    "ctaHref" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Release_slug_key" ON "Release"("slug");

-- CreateIndex
CREATE INDEX "Release_audience_publishedAt_idx" ON "Release"("audience", "publishedAt");

-- Seed: first release — the feedback widget + quality bundle that shipped in this deploy
INSERT INTO "Release" ("id", "slug", "audience", "title", "bullets", "ctaText", "ctaHref", "publishedAt", "createdAt")
VALUES (
  'rel_' || substr(md5(random()::text), 1, 20),
  '2026-04-16-beta-feedback',
  'BOTH',
  'Help us shape the app',
  '["Tap the Feedback pill in the bottom-left on any page to report bugs, flag confusing UI, request features, or share praise.","Screenshots attach via clipboard paste or file picker — we pull in the page URL, device info, and recent errors automatically.","Coaches: your team readiness widget on the dashboard now shows 28-day sparklines per athlete. Gaps are real gaps, not interpolated."]'::jsonb,
  NULL,
  NULL,
  NOW(),
  NOW()
);
