-- Venue classification + curation signals.
--
-- Purely ADDITIVE (one new enum and four new columns, all defaulted or
-- nullable), hand-written and applied with `prisma migrate deploy`. That
-- deliberately avoids `migrate dev` and its shadow database: see the shadow-DB
-- warning in CLAUDE.md — pointing a shadow at a real URL resets it and drops
-- every table.

-- RESTAURANT | CAFE. Cafes are parked: kept in the catalogue but never served
-- by a decision surface until a dedicated Cafes feature exists.
CREATE TYPE "VenueType" AS ENUM ('RESTAURANT', 'CAFE');

-- Existing rows are all restaurants, which is exactly the default, so this
-- backfills correctly without a data migration.
ALTER TABLE "Restaurant" ADD COLUMN "venueType" "VenueType" NOT NULL DEFAULT 'RESTAURANT';

-- Google's raw taxonomy, stored verbatim so re-classifying a row never needs
-- another Places call.
ALTER TABLE "Restaurant" ADD COLUMN "googlePrimaryType" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "googleTypes" TEXT[];

-- Review count behind googleRating. A curation signal only — nothing ranks off
-- it; the prune tool prints it so a 4.9-from-6-reviews row is recognisable.
ALTER TABLE "Restaurant" ADD COLUMN "googleRatingCount" INTEGER;
