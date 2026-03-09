-- AlterTable: make Invitation.email nullable for link-only invites
ALTER TABLE "Invitation" ALTER COLUMN "email" DROP NOT NULL;
