-- CreateTable: TeamLink
CREATE TABLE "TeamLink" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamFile
CREATE TABLE "TeamFile" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TeamAnnouncement
CREATE TABLE "TeamAnnouncement" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "targetType" TEXT NOT NULL DEFAULT 'ALL',
    "targetId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamLink_coachId_order_idx" ON "TeamLink"("coachId", "order");

-- CreateIndex
CREATE INDEX "TeamFile_coachId_createdAt_idx" ON "TeamFile"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamAnnouncement_coachId_createdAt_idx" ON "TeamAnnouncement"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamAnnouncement_coachId_pinned_idx" ON "TeamAnnouncement"("coachId", "pinned");

-- CreateIndex
CREATE INDEX "TeamAnnouncement_targetType_targetId_idx" ON "TeamAnnouncement"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "TeamLink" ADD CONSTRAINT "TeamLink_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamFile" ADD CONSTRAINT "TeamFile_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAnnouncement" ADD CONSTRAINT "TeamAnnouncement_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
