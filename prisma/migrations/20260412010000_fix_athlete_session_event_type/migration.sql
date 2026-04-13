-- Schema alignment: AthleteThrowsSession.event was declared as EventType enum
-- in the Prisma schema but the DB column has always been TEXT (from 0_init migration).
-- Changing the schema from EventType to String to match reality.
-- No ALTER needed — column is already TEXT.
SELECT 1;
