-- Real Dubai neighbourhood names from Google's address components.
--
-- Purely ADDITIVE (one nullable column), hand-written and applied with
-- `prisma migrate deploy` — see the shadow-DB prohibition in CLAUDE.md.
--
-- The coarse `area` enum column is left completely untouched: it is still
-- written, still read as a display fallback, and removing it is a separate
-- future migration once nothing depends on it.
ALTER TABLE "Restaurant" ADD COLUMN "areaName" TEXT;
