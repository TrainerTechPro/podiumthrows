-- CreateTable
CREATE TABLE "CodexEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "EventType" NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "thrownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodexEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodexEntry_userId_thrownAt_idx" ON "CodexEntry"("userId", "thrownAt");

-- CreateIndex
CREATE INDEX "CodexEntry_userId_event_idx" ON "CodexEntry"("userId", "event");

-- CreateIndex
CREATE INDEX "CodexEntry_implement_idx" ON "CodexEntry"("implement");

-- AddForeignKey
ALTER TABLE "CodexEntry" ADD CONSTRAINT "CodexEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
