-- Team nesting: parentTeamId (self-ref, 2-level cap enforced in app) + order column.
-- Top-level groups have parentTeamId = NULL. Cascade delete propagates to sub-groups.

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "parentTeamId" TEXT,
                   ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Team_parentTeamId_idx" ON "Team"("parentTeamId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_parentTeamId_fkey" FOREIGN KEY ("parentTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
