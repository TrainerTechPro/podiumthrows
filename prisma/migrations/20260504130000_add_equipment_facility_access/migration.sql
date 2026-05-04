-- Phase A.2 of athlete-master-profile-plan-v2 — equipmentAccess section.
-- Extends the existing EquipmentInventory model rather than creating a
-- duplicate JSON column on AthleteProfile (which the v2 plan didn't catch).
-- The model already owns implement weights + facility booleans + gym
-- equipment; these two columns close the spec gap.
--
-- facility: free text (university, club, garage, etc.)
-- weightRoomAccess: "FULL" | "LIMITED" | "NONE"

ALTER TABLE "EquipmentInventory" ADD COLUMN "facility" TEXT;
ALTER TABLE "EquipmentInventory" ADD COLUMN "weightRoomAccess" TEXT;
