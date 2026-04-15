-- H-2: Link ProgrammedSession (scheduled instance) to WorkoutPlan (template)
-- and add macrocycle Phase enum on WorkoutPlan.
--
-- Design intent (see Decision Log: "Flat IA — Plans + Schedule as peers"):
--   * WorkoutPlan is a reusable template (macrocycle container).
--   * ProgrammedSession is a scheduled instance. It MAY be the realization of
--     a plan ("assign plan X to athlete Y starting Monday") or it MAY be
--     ad-hoc (no plan). Hence planId is nullable.
--   * ON DELETE SET NULL: deleting a plan should not cascade-delete
--     already-scheduled sessions that athletes may be mid-way through.
--
-- Rollback:
--   ALTER TABLE "ProgrammedSession" DROP CONSTRAINT "ProgrammedSession_planId_fkey";
--   DROP INDEX "ProgrammedSession_planId_idx";
--   ALTER TABLE "ProgrammedSession" DROP COLUMN "planId";
--   ALTER TABLE "WorkoutPlan" DROP COLUMN "phase";
--   DROP TYPE "PhaseType";

-- CreateEnum — Bondarchuk macrocycle phases (Volume IV terminology).
CREATE TYPE "PhaseType" AS ENUM (
  'GPP',
  'SPP',
  'COMPETITION',
  'TRANSITION'
);

-- AlterTable — optional phase annotation on plan.
ALTER TABLE "WorkoutPlan" ADD COLUMN "phase" "PhaseType";

-- AlterTable — optional link from scheduled instance to template.
ALTER TABLE "ProgrammedSession" ADD COLUMN "planId" TEXT;

-- CreateIndex — supports "show me all sessions for plan X" queries used by
-- the plan detail view's calendar and the upcoming compliance dashboard.
CREATE INDEX "ProgrammedSession_planId_idx" ON "ProgrammedSession"("planId");

-- AddForeignKey — SetNull on delete; see header comment.
ALTER TABLE "ProgrammedSession"
  ADD CONSTRAINT "ProgrammedSession_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
